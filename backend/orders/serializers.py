from rest_framework import serializers

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
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "orderNumber",
            "groupId",
            "splitIndex",
            "warehouse",
            "status",
            "merchandiseTotal",
            "shippingTotal",
            "grandTotal",
            "customerName",
            "customerEmail",
            "commissionAmount",
            "createdAt",
            "items",
        ]


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
