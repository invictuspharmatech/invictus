from django.db import transaction
from django.utils import timezone

from accounts.permissions import is_full_admin, managed_warehouse
from catalog.models import Product, StockTransferRequest
from cms.models import WarehouseSettings
from orders.models import FulfillmentRequest, Order, OrderItem
from orders.order_numbers import warehouse_order_suffix
from orders.totals import allocate_weighted, money

W1 = Product.Warehouse.WAREHOUSE_1
W2 = Product.Warehouse.WAREHOUSE_2


class FulfillmentError(Exception):
    pass


def opposite_warehouse(code: str) -> str:
    return W2 if code == W1 else W1


def get_warehouse_settings() -> WarehouseSettings:
    settings_row, _ = WarehouseSettings.objects.get_or_create(pk=1)
    return settings_row


def can_cover(stock: int, needed: int, backorder_allowed: bool) -> bool:
    if needed <= 0:
        return True
    if backorder_allowed:
        return True
    return stock >= needed


def allocate_quantity(product: Product, quantity: int, policy: WarehouseSettings) -> list[tuple[str, int]]:
    home = product.warehouse
    other = opposite_warehouse(home)
    home_stock = product.stock_for(home)
    other_stock = product.stock_for(other)
    total = home_stock + other_stock

    if not product.allow_backorder and quantity > total:
        raise FulfillmentError(f"Not enough stock for {product.name}.")

    if policy.split_enabled and policy.auto_split_enabled:
        from_home = min(quantity, max(home_stock, 0))
        remainder = quantity - from_home
        if remainder and not can_cover(other_stock, remainder, product.allow_backorder):
            raise FulfillmentError(f"Not enough stock for {product.name}.")
        allocations: list[tuple[str, int]] = []
        if from_home:
            allocations.append((home, from_home))
        if remainder:
            allocations.append((other, remainder))
        return allocations

    if not can_cover(home_stock, quantity, product.allow_backorder):
        raise FulfillmentError(f"Not enough stock for {product.name}.")
    return [(home, quantity)]


def decrement_allocations(allocations: list[tuple[Product, str, int]]) -> None:
    for product, warehouse, quantity in allocations:
        product.adjust_stock(warehouse, -quantity, save=True)


def restock_order(order: Order) -> None:
    for item in order.items.select_related("product"):
        if item.product_id:
            item.product.adjust_stock(order.warehouse, item.quantity, save=True)


def recalc_merchandise(order: Order) -> None:
    raw = sum(float(item.line_total) for item in order.items.all())
    order.merchandise_total = money(max(0, raw - float(order.discount_total or 0)))
    order.save(update_fields=["merchandise_total"])


def recalc_totals_keep_shipping(order: Order) -> None:
    """Update merchandise + grand total without touching shipping_total (50/50 stays put)."""
    raw = sum(float(item.line_total) for item in order.items.all())
    order.merchandise_total = money(max(0, raw - float(order.discount_total or 0)))
    order.grand_total = money(float(order.merchandise_total) + float(order.shipping_total or 0))
    order.save(update_fields=["merchandise_total", "grand_total"])


SPLIT_ELIGIBLE_STATUSES = (
    Order.Status.PAID,
    Order.Status.PROCESSING,
    Order.Status.PARTIALLY_FILLED,
)


def _append_note(order: Order, note: str) -> None:
    text = (note or "").strip()
    if not text:
        return
    existing = (order.notes or "").strip()
    order.notes = f"{existing}\n{text}".strip() if existing else text
    order.save(update_fields=["notes"])


def find_processing_order_for_customer(
    *,
    email: str,
    warehouse: str,
    exclude_order_id=None,
    prefer_group_id: str | None = None,
) -> Order | None:
    qs = (
        Order.objects.filter(
            customer_email__iexact=(email or "").strip(),
            warehouse=warehouse,
            status__in=SPLIT_ELIGIBLE_STATUSES,
        )
        .exclude(status__in=[Order.Status.CANCELLED, Order.Status.FAILED])
        .order_by("-created_at")
    )
    if exclude_order_id:
        qs = qs.exclude(pk=exclude_order_id)
    if prefer_group_id:
        same_group = qs.filter(group_id=prefer_group_id).first()
        if same_group:
            return same_group
    return qs.first()


def create_split_fulfillment_order(source: Order, warehouse: str, note: str = "") -> Order:
    """New order # for dest WH; same group_id so payment invoice resolves for reference only."""
    from orders.order_numbers import allocate_order_number

    order_number = allocate_order_number(warehouse)
    ref = (
        f"Fulfillment split from {source.order_number}. "
        f"Payment reference group {source.group_id} (no new charge)."
    )
    combined_note = "\n".join(part for part in [(note or "").strip(), ref] if part)
    return Order.objects.create(
        order_number=order_number,
        group_id=source.group_id,
        split_index=max(2, int(source.split_index or 1) + 1),
        warehouse=warehouse,
        user=source.user,
        status=Order.Status.PROCESSING,
        payment_status=source.payment_status or Order.PaymentStatus.PAID,
        payment_method=source.payment_method or "btc",
        merchandise_total=0,
        shipping_total=0,
        grand_total=0,
        customer_name=source.customer_name,
        customer_email=source.customer_email,
        shipping_line1=source.shipping_line1,
        shipping_line2=source.shipping_line2,
        shipping_city=source.shipping_city,
        shipping_state=source.shipping_state,
        shipping_postal=source.shipping_postal,
        shipping_country=source.shipping_country,
        notes=combined_note,
        affiliate=source.affiliate,
        commission_amount=0,
        coupon=source.coupon,
        coupon_code=source.coupon_code,
        discount_total=0,
        shipping_waived=source.shipping_waived,
        paid_at=source.paid_at,
    )


def _transfer_line_stock(
    product: Product,
    source_warehouse: str,
    dest_warehouse: str,
    quantity: int,
    *,
    restock_source: bool,
) -> None:
    if restock_source:
        product.adjust_stock(source_warehouse, quantity, save=True)
    product.adjust_stock(dest_warehouse, -quantity, save=True)


def _move_lines_to_order(
    moves: list[tuple[OrderItem, int]],
    dest_order: Order,
    dest_warehouse: str,
    *,
    restock_source: bool,
) -> None:
    for item, quantity in moves:
        source = item.order
        product = item.product
        _transfer_line_stock(
            product,
            source.warehouse,
            dest_warehouse,
            quantity,
            restock_source=restock_source,
        )
        dest_line = dest_order.items.filter(product_id=product.id).first() if product else None
        line_total = money(float(item.unit_price) * quantity)
        if dest_line:
            dest_line.quantity += quantity
            dest_line.line_total = money(float(dest_line.unit_price) * dest_line.quantity)
            dest_line.warehouse = dest_warehouse
            dest_line.save(update_fields=["quantity", "line_total", "warehouse"])
        else:
            OrderItem.objects.create(
                order=dest_order,
                product=product,
                name=item.name,
                sku=item.sku,
                unit_price=item.unit_price,
                quantity=quantity,
                line_total=line_total,
                warehouse=dest_warehouse,
            )
        if quantity >= item.quantity:
            item.delete()
        else:
            item.quantity -= quantity
            item.line_total = money(float(item.unit_price) * item.quantity)
            item.save(update_fields=["quantity", "line_total"])


@transaction.atomic
def admin_split_move(
    source: Order,
    item_specs: list[dict],
    dest_warehouse: str,
    *,
    restock_source: bool = False,
    note: str = "",
) -> dict:
    """
    Admin fulfillment split for paid/processing orders.

    - Full move (all lines, full qty): reassign warehouse on the same order.
    - Partial: merge into an existing processing order for the same customer at
      dest WH, or create a new order (new order #, same group_id, no new payment).
    - Shipping totals are left untouched (site-wide 50/50 attribution).
    - Merchandise/grand totals are recalculated on affected orders.
    - restock_source default False (oversold-safe).
    """
    dest_warehouse = (dest_warehouse or "").strip().upper()
    if dest_warehouse not in (W1, W2):
        raise FulfillmentError("Choose Warehouse 1 or Warehouse 2.")
    if dest_warehouse == source.warehouse:
        raise FulfillmentError("Item is already in that warehouse.")
    if source.status not in SPLIT_ELIGIBLE_STATUSES:
        raise FulfillmentError("Only paid / processing orders can be split between warehouses.")

    source = Order.objects.select_for_update().prefetch_related("items").get(pk=source.pk)
    items_by_id = {str(item.id): item for item in source.items.select_related("product").all()}
    if not items_by_id:
        raise FulfillmentError("This order has no items to move.")

    moves: list[tuple[OrderItem, int]] = []
    warnings: list[str] = []
    for spec in item_specs:
        item_id = str(spec.get("itemId") or spec.get("item_id") or "")
        item = items_by_id.get(item_id)
        if not item:
            raise FulfillmentError("One of the selected items was not found on this order.")
        try:
            quantity = int(spec.get("quantity") if spec.get("quantity") is not None else item.quantity)
        except (TypeError, ValueError) as exc:
            raise FulfillmentError("Invalid quantity.") from exc
        if quantity < 1 or quantity > item.quantity:
            raise FulfillmentError(f"Invalid quantity for {item.name}.")
        product = item.product
        if product:
            dest_stock = product.stock_for(dest_warehouse)
            if not can_cover(dest_stock, quantity, product.allow_backorder):
                warnings.append(
                    f"{item.name}: {dest_warehouse} has {dest_stock} in stock; moving {quantity} anyway."
                )
        moves.append((item, quantity))

    if not moves:
        raise FulfillmentError("Select at least one item to move.")

    covering_all = len(moves) == len(items_by_id) and all(
        qty == items_by_id[str(item.id)].quantity for item, qty in moves
    )

    if covering_all:
        for item, quantity in moves:
            product = item.product
            if product:
                _transfer_line_stock(
                    product,
                    source.warehouse,
                    dest_warehouse,
                    quantity,
                    restock_source=restock_source,
                )
            item.warehouse = dest_warehouse
            item.save(update_fields=["warehouse"])
        source.warehouse = dest_warehouse
        source.save(update_fields=["warehouse"])
        if note:
            _append_note(source, note.strip())
        recalc_totals_keep_shipping(source)
        return {
            "mode": "reassign",
            "sourceOrderId": str(source.id),
            "destOrderId": str(source.id),
            "warnings": warnings,
            "restockSource": bool(restock_source),
        }

    dest_order = find_processing_order_for_customer(
        email=source.customer_email,
        warehouse=dest_warehouse,
        exclude_order_id=source.id,
        prefer_group_id=source.group_id,
    )
    created = False
    if dest_order is None:
        dest_order = create_split_fulfillment_order(source, dest_warehouse, note=note)
        created = True
    else:
        dest_order = Order.objects.select_for_update().get(pk=dest_order.pk)
        if note:
            _append_note(dest_order, note.strip())

    _move_lines_to_order(moves, dest_order, dest_warehouse, restock_source=restock_source)

    source = Order.objects.select_for_update().prefetch_related("items").get(pk=source.pk)
    if not source.items.exists():
        # Safety net if every line was moved outside the full-reassign path.
        source.status = Order.Status.CANCELLED
        source.save(update_fields=["status"])

    if note:
        _append_note(source, f"Split to {dest_order.order_number}: {note.strip()}")

    recalc_totals_keep_shipping(source)
    recalc_totals_keep_shipping(dest_order)
    return {
        "mode": "created" if created else "merged",
        "sourceOrderId": str(source.id),
        "destOrderId": str(dest_order.id),
        "destOrderNumber": dest_order.order_number,
        "warnings": warnings,
        "restockSource": bool(restock_source),
    }


def assert_order_editable(order: Order, user=None) -> None:
    """Block edits on terminal statuses unless the actor is a full admin/superuser."""
    if is_full_admin(user):
        return
    if order.status in (
        Order.Status.CANCELLED,
        Order.Status.REFUNDED,
        Order.Status.FAILED,
    ):
        raise FulfillmentError("This order cannot be edited.")


@transaction.atomic
def set_order_item_quantity(item: OrderItem, new_qty: int, user=None) -> None:
    """Adjust qty on a line (0 removes). Restocks or deducts against the order warehouse."""
    order = Order.objects.select_for_update().get(pk=item.order_id)
    assert_order_editable(order, user=user)
    item = OrderItem.objects.select_for_update().select_related("product").get(pk=item.pk)
    if item.order_id != order.id:
        raise FulfillmentError("Item not found on this order.")
    new_qty = int(new_qty)
    if new_qty < 0:
        raise FulfillmentError("Quantity cannot be negative.")
    old_qty = int(item.quantity)
    if new_qty == old_qty:
        return
    product = item.product
    warehouse = order.warehouse
    if new_qty > old_qty:
        add = new_qty - old_qty
        if not can_cover(product.stock_for(warehouse), add, product.allow_backorder):
            raise FulfillmentError(f"Not enough stock for {item.name}.")
        product.adjust_stock(warehouse, -add, save=True)
        item.quantity = new_qty
        item.line_total = money(float(item.unit_price) * new_qty)
        item.save(update_fields=["quantity", "line_total"])
    else:
        return_qty = old_qty - new_qty
        if return_qty > 0 and product:
            product.adjust_stock(warehouse, return_qty, save=True)
        if new_qty == 0:
            item.delete()
        else:
            item.quantity = new_qty
            item.line_total = money(float(item.unit_price) * new_qty)
            item.save(update_fields=["quantity", "line_total"])
    if not order.items.exists():
        raise FulfillmentError("The order must keep at least one line item.")
    apply_group_shipping(order.group_id)


@transaction.atomic
def add_product_to_order(order: Order, product: Product, quantity: int = 1, user=None) -> OrderItem:
    order = Order.objects.select_for_update().get(pk=order.pk)
    assert_order_editable(order, user=user)
    quantity = max(1, int(quantity))
    product = Product.objects.select_for_update().get(pk=product.pk)
    if product.status != "publish":
        raise FulfillmentError("Only active products can be added.")
    warehouse = order.warehouse
    if not can_cover(product.stock_for(warehouse), quantity, product.allow_backorder):
        raise FulfillmentError(f"Not enough stock for {product.name}.")
    existing = (
        order.items.select_for_update()
        .filter(product_id=product.id)
        .first()
    )
    product.adjust_stock(warehouse, -quantity, save=True)
    if existing:
        existing.quantity += quantity
        existing.line_total = money(float(existing.unit_price) * existing.quantity)
        existing.save(update_fields=["quantity", "line_total"])
        apply_group_shipping(order.group_id)
        return existing
    unit = float(product.sale_price if product.sale_price is not None and product.sale_price > 0 else product.regular_price or 0)
    item = OrderItem.objects.create(
        order=order,
        product=product,
        name=product.name,
        sku=product.sku or "",
        unit_price=unit,
        quantity=quantity,
        line_total=money(unit * quantity),
        warehouse=warehouse,
    )
    apply_group_shipping(order.group_id)
    return item


def _terminal_statuses() -> list[str]:
    return [Order.Status.CANCELLED, Order.Status.FAILED]


def live_group_orders(order_or_group_id: Order | str) -> list[Order]:
    group_id = order_or_group_id if isinstance(order_or_group_id, str) else order_or_group_id.group_id
    if not group_id:
        return [order_or_group_id] if isinstance(order_or_group_id, Order) else []
    return list(
        Order.objects.filter(group_id=group_id)
        .exclude(status__in=_terminal_statuses())
        .order_by("split_index", "created_at")
    )


def payment_primary(order: Order) -> Order:
    live = live_group_orders(order)
    return live[0] if live else order


def group_grand_total(order: Order) -> float:
    return money(sum(float(row.grand_total) for row in live_group_orders(order)))


def apply_group_shipping(group_id: str, shipping_usd: float | None = None) -> None:
    from orders.totals import equal_warehouse_shipping_shares

    orders = live_group_orders(group_id)
    live = []
    empty = []
    group_discount = 0.0
    waived = False
    for order in orders:
        group_discount += float(order.discount_total or 0)
        waived = waived or bool(order.shipping_waived)
        if order.items.exists():
            live.append(order)
        else:
            empty.append(order)
    for order in empty:
        order.delete()
    if not live:
        return
    raws = [sum(float(item.line_total) for item in order.items.all()) for order in live]
    discount_shares = allocate_weighted(group_discount, raws)
    if shipping_usd is None:
        from orders.shop_config import get_default_shipping_usd

        shipping_usd = get_default_shipping_usd()
    shipping = 0.0 if waived else money(shipping_usd)
    by_warehouse = {order.warehouse: order for order in live}
    # Book 50/50 on the order rows when both warehouses fulfill. When only one
    # warehouse has items, keep the full fee on that row for the customer invoice;
    # accounting / dashboard still attribute shipping 50/50 to both warehouses.
    if W1 in by_warehouse and W2 in by_warehouse:
        w1_ship, w2_ship = equal_warehouse_shipping_shares(shipping)
        ship_by_warehouse = {W1: w1_ship, W2: w2_ship}
    else:
        ship_by_warehouse = {live[0].warehouse: shipping}
    for index, order in enumerate(live):
        share = ship_by_warehouse.get(order.warehouse, 0.0)
        merch = money(max(0, raws[index] - discount_shares[index]))
        order.discount_total = discount_shares[index]
        order.merchandise_total = merch
        order.shipping_total = share
        order.grand_total = money(merch + share)
        order.save(update_fields=["discount_total", "merchandise_total", "shipping_total", "grand_total"])


def sibling_order(source: Order, warehouse: str) -> Order:
    """
    Ensure a warehouse split row exists for this checkout group.

    Never allocates a new yearly sequence number. BTCPay invoices key off
    group_id; the creation-time number on the original row stays unchanged.
    A late sibling only needs a unique DB order_number, so it reuses group_id
    with a warehouse suffix (e.g. 2026W10001-2).
    """
    existing = (
        Order.objects.filter(group_id=source.group_id, warehouse=warehouse)
        .exclude(status__in=[Order.Status.CANCELLED, Order.Status.FAILED])
        .first()
    )
    if existing:
        return existing
    suffix = warehouse_order_suffix(warehouse)
    return Order.objects.create(
        order_number=f"{source.group_id}-{suffix}",
        group_id=source.group_id,
        split_index=2 if warehouse != source.warehouse else source.split_index,
        warehouse=warehouse,
        user=source.user,
        status=source.status,
        merchandise_total=0,
        shipping_total=0,
        grand_total=0,
        customer_name=source.customer_name,
        customer_email=source.customer_email,
        shipping_line1=source.shipping_line1,
        shipping_line2=source.shipping_line2,
        shipping_city=source.shipping_city,
        shipping_state=source.shipping_state,
        shipping_postal=source.shipping_postal,
        shipping_country=source.shipping_country,
        notes=source.notes,
        affiliate=source.affiliate,
        commission_amount=0,
        coupon=source.coupon,
        coupon_code=source.coupon_code,
        discount_total=0,
        shipping_waived=source.shipping_waived,
        paid_at=source.paid_at,
    )


@transaction.atomic
def move_order_item(item: OrderItem, dest_warehouse: str, quantity: int) -> Order:
    source = item.order
    if dest_warehouse == source.warehouse:
        raise FulfillmentError("Item is already in that warehouse.")
    if quantity < 1 or quantity > item.quantity:
        raise FulfillmentError("Invalid quantity to move.")
    product = item.product
    dest_stock = product.stock_for(dest_warehouse)
    if not can_cover(dest_stock, quantity, product.allow_backorder):
        raise FulfillmentError("The other warehouse does not have enough stock.")

    product.adjust_stock(source.warehouse, quantity, save=True)
    product.adjust_stock(dest_warehouse, -quantity, save=True)

    dest_order = sibling_order(source, dest_warehouse)
    dest_line = dest_order.items.filter(product=product).first()
    line_total = item.unit_price * quantity
    if dest_line:
        dest_line.quantity += quantity
        dest_line.line_total = dest_line.unit_price * dest_line.quantity
        dest_line.warehouse = dest_warehouse
        dest_line.save()
    else:
        OrderItem.objects.create(
            order=dest_order,
            product=product,
            name=item.name,
            sku=item.sku,
            unit_price=item.unit_price,
            quantity=quantity,
            line_total=line_total,
            warehouse=dest_warehouse,
        )

    if quantity == item.quantity:
        item.delete()
    else:
        item.quantity -= quantity
        item.line_total = item.unit_price * item.quantity
        item.save(update_fields=["quantity", "line_total"])

    recalc_merchandise(source)
    recalc_merchandise(dest_order)
    apply_group_shipping(source.group_id)
    return dest_order


def assert_can_move(user, source_warehouse: str, immediate: bool) -> None:
    policy = get_warehouse_settings()
    if not policy.split_enabled:
        raise FulfillmentError("Warehouse splitting is disabled.")
    if immediate:
        if not policy.manual_move_enabled:
            raise FulfillmentError("Manual warehouse moves are disabled.")
        if not is_full_admin(user):
            raise FulfillmentError("Only admins can move items immediately.")
        return
    if not policy.warehouse_request_enabled:
        raise FulfillmentError("Warehouse requests are disabled.")
    warehouse = managed_warehouse(user)
    if warehouse and warehouse != source_warehouse and not is_full_admin(user):
        raise FulfillmentError("You can only request moves from your warehouse.")


@transaction.atomic
def approve_stock_transfer(request_row: StockTransferRequest, reviewer) -> None:
    if request_row.status != StockTransferRequest.Status.PENDING:
        raise FulfillmentError("This request was already reviewed.")
    product = Product.objects.select_for_update().get(pk=request_row.product_id)
    available = product.stock_for(request_row.from_warehouse)
    if not can_cover(available, request_row.quantity, product.allow_backorder):
        raise FulfillmentError("Not enough stock to approve this transfer.")
    product.adjust_stock(request_row.from_warehouse, -request_row.quantity, save=True)
    product.adjust_stock(request_row.to_warehouse, request_row.quantity, save=True)
    request_row.status = StockTransferRequest.Status.APPROVED
    request_row.reviewed_by = reviewer
    request_row.reviewed_at = timezone.now()
    request_row.save(update_fields=["status", "reviewed_by", "reviewed_at"])


def reject_stock_transfer(request_row: StockTransferRequest, reviewer) -> None:
    if request_row.status != StockTransferRequest.Status.PENDING:
        raise FulfillmentError("This request was already reviewed.")
    request_row.status = StockTransferRequest.Status.REJECTED
    request_row.reviewed_by = reviewer
    request_row.reviewed_at = timezone.now()
    request_row.save(update_fields=["status", "reviewed_by", "reviewed_at"])


@transaction.atomic
def approve_fulfillment_request(request_row: FulfillmentRequest, reviewer) -> None:
    if request_row.status != FulfillmentRequest.Status.PENDING:
        raise FulfillmentError("This request was already reviewed.")
    item = request_row.order_item
    if item is None:
        raise FulfillmentError("The order item is no longer available.")
    quantity = request_row.quantity
    dest = request_row.to_warehouse
    request_row.status = FulfillmentRequest.Status.APPROVED
    request_row.reviewed_by = reviewer
    request_row.reviewed_at = timezone.now()
    request_row.save(update_fields=["status", "reviewed_by", "reviewed_at"])
    move_order_item(item, dest, quantity)


def reject_fulfillment_request(request_row: FulfillmentRequest, reviewer) -> None:
    if request_row.status != FulfillmentRequest.Status.PENDING:
        raise FulfillmentError("This request was already reviewed.")
    request_row.status = FulfillmentRequest.Status.REJECTED
    request_row.reviewed_by = reviewer
    request_row.reviewed_at = timezone.now()
    request_row.save(update_fields=["status", "reviewed_by", "reviewed_at"])


def can_review_transfer(user, from_warehouse: str) -> bool:
    if is_full_admin(user):
        return True
    return managed_warehouse(user) == from_warehouse


def can_review_fulfillment(user, to_warehouse: str) -> bool:
    if is_full_admin(user):
        return True
    return managed_warehouse(user) == to_warehouse
