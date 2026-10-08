from pathlib import Path


def test_dashboard_proxy_allows_identity_and_notifications():
    source = Path("app/api/dashboard_proxy.py").read_text(encoding="utf-8")
    assert 're.compile(r"^/identity-graph$")' in source
    assert 're.compile(r"^/notifications$")' in source
    assert 're.compile(r"^/notifications/[0-9a-fA-F-]{36}/read$")' in source
    assert 're.compile(r"^/notifications/read-all$")' in source


def test_dashboard_cors_allows_store_selector_header():
    source = Path("app/main.py").read_text(encoding="utf-8")
    assert "X-Ordium-Store-ID" in source
