from rest_framework import serializers

from orders.btcpay import serialize_invoice
from orders.models import ContactMessage, FulfillmentRequest, Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):
    productId = serializers.UUIDField(source="product_id", allow_null=True)
    unitPrice = serializers.FloatField(source="unit_price")
    lineTotal = serializers.FloatField(source="line_total")

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "productId",
            "name",
            "sku",
            "unitPrice",
            "quantity",
            "lineTotal",
            "warehouse",
        ]


class OrderSerializer(serializers.ModelSerializer):
    orderNumber = serializers.CharField(source="order_number")
    groupId = serializers.CharField(source="group_id")
    splitIndex = serializers.IntegerField(source="split_index")
    merchandiseTotal = serializers.FloatField(source="merchandise_total")
    shippingTotal = serializers.FloatField(source="shipping_total")
    grandTotal = serializers.FloatField(source="grand_total")
    customerName = serializers.CharField(source="customer_name")
    customerEmail = serializers.EmailField(source="customer_email")
    commissionAmount = serializers.FloatField(source="commission_amount")
    createdAt = serializers.DateTimeField(source="created_at")
    paymentStatus = serializers.CharField(source="payment_status")
    paymentMethod = serializers.CharField(source="payment_method")
    trackingNumber = serializers.CharField(source="tracking_number")
    userId = serializers.UUIDField(source="user_id", allow_null=True, read_only=True)
    shippingLine1 = serializers.CharField(source="shipping_line1")
    shippingLine2 = serializers.CharField(source="shipping_line2")
    shippingCity = serializers.CharField(source="shipping_city")
    shippingState = serializers.CharField(source="shipping_state")
    shippingPostal = serializers.CharField(source="shipping_postal")
    shippingCountry = serializers.CharField(source="shipping_country")
    notes = serializers.CharField()
    items = OrderItemSerializer(many=True, read_only=True)
    btcInvoice = serializers.SerializerMethodField()
    shippingLabels = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "orderNumber",
            "groupId",
            "splitIndex",
            "warehouse",
            "status",
            "paymentStatus",
            "paymentMethod",
            "merchandiseTotal",
            "shippingTotal",
            "grandTotal",
            "customerName",
            "customerEmail",
            "commissionAmount",
            "createdAt",
            "trackingNumber",
            "userId",
            "shippingLine1",
            "shippingLine2",
            "shippingCity",
            "shippingState",
            "shippingPostal",
            "shippingCountry",
            "notes",
            "items",
            "btcInvoice",
            "shippingLabels",
        ]

    def get_btcInvoice(self, obj):
        return serialize_invoice(obj.btc_invoice)

    def get_shippingLabels(self, obj):
        from orders.bitcoinpostage import serialize_label

        labels = getattr(obj, "_prefetched_objects_cache", {}).get("shipping_labels")
        rows = list(labels) if labels is not None else list(obj.shipping_labels.all())
        return [serialize_label(row) for row in rows]


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ["id", "name", "email", "subject", "message", "created_at"]


class FulfillmentRequestSerializer(serializers.ModelSerializer):
    orderId = serializers.UUIDField(source="order_id")
    orderNumber = serializers.CharField(source="order.order_number", read_only=True)
    orderItemId = serializers.UUIDField(source="order_item_id", allow_null=True)
    productName = serializers.SerializerMethodField()
    fromWarehouse = serializers.CharField(source="from_warehouse")
    toWarehouse = serializers.CharField(source="to_warehouse")
    requestedBy = serializers.CharField(source="requested_by.email", read_only=True, allow_null=True)
    reviewedBy = serializers.CharField(source="reviewed_by.email", read_only=True, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    reviewedAt = serializers.DateTimeField(source="reviewed_at", read_only=True, allow_null=True)

    class Meta:
        model = FulfillmentRequest
        fields = [
            "id",
            "orderId",
            "orderNumber",
            "orderItemId",
            "productName",
            "quantity",
            "fromWarehouse",
            "toWarehouse",
            "status",
            "note",
            "requestedBy",
            "reviewedBy",
            "createdAt",
            "reviewedAt",
        ]

    def get_productName(self, obj):
        if obj.order_item_id and obj.order_item:
            return obj.order_item.name
        return ""
