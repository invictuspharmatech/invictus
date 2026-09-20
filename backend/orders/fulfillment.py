from django.conf import settings
from django.db import transaction
from django.utils import timezone

from accounts.permissions import is_full_admin, managed_warehouse
from catalog.models import Product, StockTransferRequest
from cms.models import WarehouseSettings
from orders.models import FulfillmentRequest, Order, OrderItem

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
    total = sum(item.line_total for item in order.items.all())
    order.merchandise_total = total
    order.save(update_fields=["merchandise_total"])


def apply_group_shipping(group_id: str) -> None:
    shipping = float(settings.SHIPPING_USD)
    orders = list(Order.objects.filter(group_id=group_id).exclude(status=Order.Status.CANCELLED))
    live = []
    empty = []
    for order in orders:
        if order.items.exists():
            live.append(order)
        else:
            empty.append(order)
    for order in empty:
        order.delete()
    if not live:
        return
    share = shipping if len(live) == 1 else round(shipping / 2, 2)
    for order in live:
        order.shipping_total = share
        order.grand_total = float(order.merchandise_total) + share
        order.save(update_fields=["shipping_total", "grand_total"])


def sibling_order(source: Order, warehouse: str) -> Order:
    existing = (
        Order.objects.filter(group_id=source.group_id, warehouse=warehouse)
        .exclude(status=Order.Status.CANCELLED)
        .first()
    )
    if existing:
        return existing
    suffix = "W1" if warehouse == W1 else "W2"
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
