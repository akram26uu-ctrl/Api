from pathlib import Path

ID = "0b8f6f0e-1a2b-4c3d-8e4f-5a6b7c8d9e0f"


def test_shipping_paths_allowed_and_others_404():
    from app.api.dashboard_proxy import _allowed
    for path in (
        "/shipping/carriers", f"/shipping/carriers/{ID}", f"/shipping/carriers/{ID}/test",
        f"/shipping/carriers/{ID}/disable", f"/shipping/carriers/{ID}/warehouses",
        "/shipping/routes", f"/shipping/routes/{ID}", "/shipping/settings",
        "/shipping/shipments", f"/shipping/shipments/{ID}", f"/shipping/shipments/{ID}/retry",
        f"/shipping/shipments/{ID}/cancel", "/shipping/next-pickups", "/shipping/pending",
        f"/shipping/pending/{ID}/approve", f"/shipping/pending/{ID}/reject",
        f"/shipping/pending/{ID}/restore", f"/shipping/pending/{ID}/archive",
        f"/shipping/pending/{ID}/dispatch-from",
        "/inventory/products", "/inventory/stock", "/inventory/deposits", "/inventory/movements",
        f"/inventory/products/{ID}", f"/inventory/products/{ID}/links", f"/inventory/products/{ID}/status",
        "/inventory/products/unmapped",
    ):
        assert _allowed(path), path
    for path in (
        "/shipping", "/shipping/carriers/x", f"/shipping/carriers/{ID}/delete",
        f"/shipping/shipments/{ID}/approve", f"/shipping/pending/{ID}", "/shipping/pending/x/approve",
        f"/shipping/next-pickups/{ID}", "/shipping/webhooks/sandbox", "/inventory", "/inventory/other",
        "/shipping/settings/x",
    ):
        assert not _allowed(path), path


def test_store_header_forwarded_as_query_for_shipping_and_inventory():
    source = Path("app/api/dashboard_proxy.py").read_text(encoding="utf-8")
    assert 'path.startswith("/shipping/")' in source
    assert 'path.startswith("/inventory/")' in source
