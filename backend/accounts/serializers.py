from rest_framework import serializers

from accounts.models import AffiliateApplication, User


class SessionUserSerializer(serializers.ModelSerializer):
    isAffiliate = serializers.BooleanField(source="is_affiliate")
    affiliateCode = serializers.CharField(source="affiliate_code", allow_null=True)

    class Meta:
        model = User
        fields = ["id", "email", "name", "role", "isAffiliate", "affiliateCode"]


class UserAdminSerializer(serializers.ModelSerializer):
    isAffiliate = serializers.BooleanField(source="is_affiliate")
    affiliateCode = serializers.CharField(source="affiliate_code", allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at")

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "name",
            "role",
            "isAffiliate",
            "affiliateCode",
            "createdAt",
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
