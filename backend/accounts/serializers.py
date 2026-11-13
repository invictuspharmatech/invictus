from rest_framework import serializers

from accounts.models import AffiliateApplication, User


class SessionUserSerializer(serializers.ModelSerializer):
    isAffiliate = serializers.BooleanField(source="is_affiliate")
    affiliateCode = serializers.CharField(source="affiliate_code", allow_null=True)
    launchNotify = serializers.BooleanField(source="launch_notify")

    class Meta:
        model = User
        fields = ["id", "email", "name", "role", "isAffiliate", "affiliateCode", "launchNotify"]


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
