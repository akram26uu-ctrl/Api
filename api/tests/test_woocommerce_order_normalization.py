from app.api.v1.integrations import _normalize_order


def test_woocommerce_native_order_maps_billing_and_shipping_fields():
    normalized = _normalize_order(
        {
            "id": 731,
            "currency": "DZD",
            "total": "4200.00",
            "billing": {
                "first_name": "Ali",
                "last_name": "Bena",
                "phone": "0550123456",
                "address_1": "12 Billing Road",
                "city": "Alger",
                "state": "Alger",
            },
            "shipping": {
                "first_name": "Ali",
                "last_name": "Bena",
                "address_1": "12 Delivery Road",
                "address_2": "Floor 2",
                "city": "Bab El Oued",
                "state": "Alger",
            },
            "line_items": [
                {
                    "name": "Product",
                    "sku": "SKU-731",
                    "quantity": 2,
                    "price": "2100.00",
                }
            ],
        },
        "731",
    )

    assert normalized.external_order_id == "731"
    assert normalized.first_name == "Ali"
    assert normalized.last_name == "Bena"
    assert normalized.phone == "0550123456"
    assert normalized.address == "12 Delivery Road, Floor 2"
    assert normalized.commune == "Bab El Oued"
    assert normalized.total_amount == 4200
    assert len(normalized.items) == 1
    assert normalized.items[0].product_name == "Product"
