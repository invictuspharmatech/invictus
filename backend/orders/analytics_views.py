from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsStoreStaff
from orders import analytics as analytics_service


def _ok(payload):
    return Response({"success": True, "data": payload})


@api_view(["GET"])
@permission_classes([IsStoreStaff])
def analytics_overview_view(request):
    return _ok(analytics_service.overview(request.GET))


@api_view(["GET"])
@permission_classes([IsStoreStaff])
def analytics_revenue_view(request):
    return _ok(analytics_service.revenue(request.GET))


@api_view(["GET"])
@permission_classes([IsStoreStaff])
def analytics_products_view(request):
    return _ok(analytics_service.products(request.GET))


@api_view(["GET"])
@permission_classes([IsStoreStaff])
def analytics_orders_view(request):
    return _ok(analytics_service.orders(request.GET))


@api_view(["GET"])
@permission_classes([IsStoreStaff])
def analytics_variations_view(request):
    return _ok(analytics_service.variations(request.GET))


@api_view(["GET"])
@permission_classes([IsStoreStaff])
def analytics_categories_view(request):
    return _ok(analytics_service.categories(request.GET))


@api_view(["GET"])
@permission_classes([IsStoreStaff])
def analytics_coupons_view(request):
    return _ok(analytics_service.coupons(request.GET))


@api_view(["GET"])
@permission_classes([IsStoreStaff])
def analytics_stock_view(request):
    return _ok(analytics_service.stock(request.GET))


@api_view(["GET"])
@permission_classes([IsStoreStaff])
def analytics_sales_charts_view(request):
    data, error = analytics_service.sales_charts(request.GET)
    if error:
        return Response({"success": False, "message": error}, status=422)
    return _ok(data)
