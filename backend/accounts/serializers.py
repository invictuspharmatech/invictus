from rest_framework import serializers

from accounts.models import AffiliateApplication, User


class SessionUserSerializer(serializers.ModelSerializer):
    isAffiliate = serializers.BooleanField(source="is_affiliate")
    affiliateCode = serializers.CharField(source="affiliate_code", allow_null=True)
    launchNotify = serializers.BooleanField(source="launch_notify")
    shippingLine1 = serializers.CharField(source="shipping_line1", allow_blank=True)
    shippingLine2 = serializers.CharField(source="shipping_line2", allow_blank=True)
    shippingCity = serializers.CharField(source="shipping_city", allow_blank=True)
    shippingState = serializers.CharField(source="shipping_state", allow_blank=True)
    shippingPostal = serializers.CharField(source="shipping_postal", allow_blank=True)
    shippingCountry = serializers.CharField(source="shipping_country", allow_blank=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "name",
            "role",
            "phone",
            "isAffiliate",
            "affiliateCode",
            "launchNotify",
            "shippingLine1",
            "shippingLine2",
            "shippingCity",
            "shippingState",
            "shippingPostal",
            "shippingCountry",
        ]


class UserAdminSerializer(serializers.ModelSerializer):
    isAffiliate = serializers.BooleanField(source="is_affiliate")
    affiliateCode = serializers.CharField(source="affiliate_code", allow_null=True)
    isActive = serializers.BooleanField(source="is_active")
    createdAt = serializers.DateTimeField(source="created_at")
    launchNotify = serializers.BooleanField(source="launch_notify")
    launchNotifyAt = serializers.DateTimeField(source="launch_notify_at", allow_null=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "name",
            "role",
            "isAffiliate",
            "affiliateCode",
            "isActive",
            "createdAt",
            "launchNotify",
            "launchNotifyAt",
        ]


class AffiliateUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "name", "role"]


class AffiliateApplicationSerializer(serializers.ModelSerializer):
    user = AffiliateUserSerializer()
    createdAt = serializers.DateTimeField(source="created_at")

    class Meta:
        model = AffiliateApplication
        fields = ["id", "status", "note", "createdAt", "user"]
