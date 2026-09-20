#!/bin/bash

BASE_URL="http://localhost:3000"
API_BASE="$BASE_URL/api/v1"

# 1) Health check
curl -X GET "$BASE_URL/health"

# 2) Create a single order
curl -X POST "$API_BASE/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "ORD-1001",
    "courier_partner": "urbanebolt",
    "customer": {
      "name": "Jane Doe",
      "phone": "9999999999",
      "email": "jane@example.com"
    },
    "pickup_address": {
      "name": "Seller",
      "address_line_1": "10 Market Rd",
      "city": "Bengaluru",
      "state": "Karnataka",
      "pincode": "560001",
      "country": "IN"
    },
    "delivery_address": {
      "name": "Jane Doe",
      "address_line_1": "22 Residency Rd",
      "city": "Bengaluru",
      "state": "Karnataka",
      "pincode": "560002",
      "country": "IN"
    },
    "items": [{ "sku": "SKU-1", "name": "T-shirt", "quantity": 1, "price": 499 }],
    "shipment": { "weight_kg": 0.5, "declared_value": 499 }
  }'

# 3) Track an order
curl -X GET "$API_BASE/orders/ORD-1001/track"

# 4) Cancel an order
curl -X POST "$API_BASE/orders/ORD-1001/cancel"

# 5) Create multiple orders in bulk
curl -X POST "$API_BASE/orders/bulk" \
  -H "Content-Type: application/json" \
  -d '{
    "orders": [
      {
        "order_id": "ORD-2001",
        "courier_partner": "urbanebolt",
        "customer": {
          "name": "Alice",
          "phone": "9888888888",
          "email": "alice@example.com"
        },
        "pickup_address": {
          "name": "Seller",
          "address_line_1": "1 Main St",
          "city": "Delhi",
          "state": "Delhi",
          "pincode": "110001",
          "country": "IN"
        },
        "delivery_address": {
          "name": "Alice",
          "address_line_1": "5 Rose Ave",
          "city": "Delhi",
          "state": "Delhi",
          "pincode": "110002",
          "country": "IN"
        },
        "items": [{ "sku": "SKU-2", "name": "Jeans", "quantity": 1, "price": 999 }],
        "shipment": { "weight_kg": 0.8, "declared_value": 999 }
      },
      {
        "order_id": "ORD-2002",
        "courier_partner": "mockcourier",
        "customer": {
          "name": "Bob",
          "phone": "9777777777",
          "email": "bob@example.com"
        },
        "pickup_address": {
          "name": "Seller",
          "address_line_1": "2 Park St",
          "city": "Mumbai",
          "state": "Maharashtra",
          "pincode": "400001",
          "country": "IN"
        },
        "delivery_address": {
          "name": "Bob",
          "address_line_1": "9 Lake Rd",
          "city": "Mumbai",
          "state": "Maharashtra",
          "pincode": "400002",
          "country": "IN"
        },
        "items": [{ "sku": "SKU-3", "name": "Bag", "quantity": 1, "price": 1799 }],
        "shipment": { "weight_kg": 1.2, "declared_value": 1799 }
      }
    ]
  }'

# 6) Check bulk batch status (replace with returned batch_id)
curl -X GET "$API_BASE/orders/bulk/<batch_id>"
