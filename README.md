# Ease Commerce Backend

A Node.js backend for a multi-courier shipping integration platform. The service exposes one courier-agnostic API while isolating courier-specific logic behind pluggable adapters.

## Overview
This project is designed around one requirement: internal consumers should not know or care which courier is being used. They send a normalized request with a `courier_partner` field, and the backend resolves the correct adapter and maps the internal payload to the relevant partner payload.

The current implementation includes:
- a working `urbanebolt` adapter based on the provided token/auth pattern
- a second `mockcourier` adapter for local development and extension testing
- a MySQL-backed data model for orders and tracking history
- a bulk order flow that returns a `batch_id` immediately and processes work asynchronously

## Tech stack
- Node.js
- Express.js
- MySQL 8+
- JavaScript / CommonJS
- `axios` for external courier HTTP calls

## Design choices
This project uses a layered architecture with Strategy + Factory + Repository patterns.

### Why this design
- Strategy pattern: each courier partner implements the same adapter contract
- Factory/registry pattern: `courier_partner` maps to a concrete adapter without changing routes or controllers
- Repository pattern: persistence is abstracted away from business logic
- Service layer: orchestration, validation, and business rules live in one place

This keeps the external API stable even when a new courier is added.

## Project structure
- `src/app.js` — Express app bootstrap
- `src/config.js` — environment-driven config
- `src/errors.js` — normalized error model
- `src/services/orderService.js` — order lifecycle and bulk orchestration
- `src/couriers/` — courier adapters and registry
- `src/db/index.js` — MySQL initialization and persistence layer
- `src/routes/orderRoutes.js` — REST endpoints
- `database/schema.sql` — database schema
- `test/app.test.js` — behavior-level tests

## Setup

### 1) Install dependencies
```bash
npm install
```

### 2) Create your environment file
Use the existing example file or create an env file from it:

```bash
cp .env.example .env
```

### 3) Configure MySQL
Make sure MySQL is running locally and create the database:

```sql
CREATE DATABASE IF NOT EXISTS ease_commerce;
```

Then run the schema file:

```bash
mysql -u root -p < database/schema.sql
```

### 4) Update environment values
Open `.env` and set your local MySQL and courier values:

```env
PORT=3000
NODE_ENV=development
DB_CLIENT=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=ease_commerce
REQUEST_TIMEOUT_MS=15000
RETRY_MAX_ATTEMPTS=3
RETRY_BACKOFF_MS=500
URBANEBOLT_BASE_URL=https://uat.urbanebolt.in
URBANEBOLT_USERNAME=your_urbanebolt_username
URBANEBOLT_PASSWORD=your_urbanebolt_password
URBANEBOLT_API_KEY=demo-key
URBANEBOLT_API_SECRET=demo-secret
MOCKCOURIER_BASE_URL=https://mockcourier.example.com
MOCKCOURIER_API_KEY=demo-key
```

### 5) Start the server
```bash
npm start
```

### 6) Verify health
```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

## API contract

### Create order
`POST /api/v1/orders`

Request body example:

```json
{
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
  "items": [
    { "sku": "SKU-1", "name": "T-shirt", "quantity": 1, "price": 499 }
  ],
  "shipment": {
    "weight_kg": 0.5,
    "declared_value": 499
  }
}
```

### Track order
`GET /api/v1/orders/:order_id/track`

### Cancel order
`POST /api/v1/orders/:order_id/cancel`

### Bulk create orders
`POST /api/v1/orders/bulk`

Behavior:
- accepts up to 100 orders in one request
- processes each order concurrently in the background
- returns a `batch_id` immediately
- supports partial success reporting per order
- idempotency is enforced via `order_id` at the service layer

### Bulk status
`GET /api/v1/orders/bulk/:batch_id`

## Error handling
All endpoints use a normalized error contract:

```json
{
  "success": false,
  "request_id": "uuid",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "order_id is required",
    "status": 400,
    "details": {
      "field": "order_id"
    }
  }
}
```

Key behaviors:
- validation failure → HTTP 400
- unknown courier → HTTP 400 with supported couriers list
- courier 4xx → mapped to internal normalized error codes
- courier 5xx / retry failures → logged and persisted for reconciliation
- auth failures → token refresh / re-authentication flow

## Adding a new courier
To add a new courier, follow these steps:

1. Create a new adapter class in `src/couriers/`
2. Extend the shared base adapter contract
3. Implement methods for:
   - `authenticate()`
   - `createOrder()`
   - `trackOrder()`
   - `cancelOrder()`
4. Register the adapter in `src/couriers/registry.js`
5. Add environment variables in `.env.example` and `.env`
6. Use the new `courier_partner` name in all consumer requests

Example pattern:

```js
const { BaseCourierAdapter } = require('./baseAdapter');

class DelhiveryAdapter extends BaseCourierAdapter {
  async authenticate() {
    return { ok: true };
  }

  async createOrder(normalizedOrder) {
    return {
      success: true,
      status: 'CREATED',
      courier_order_id: 'DEL-100',
      awb_number: 'AWB-DEL-100',
      request_payload: normalizedOrder,
      response_payload: { status: 'CREATED' }
    };
  }
}
```

Then register it:

```js
adapterMap.delhivery = new DelhiveryAdapter(runtimeConfig.courier.delhivery);
```

No controller, route, or normalized DTO changes are required for the new courier.

## Database schema
The app persists:
- `orders` — current shipment state and audit payloads
- `order_tracking_history` — append-only status timeline
- `bulk_batches` and `bulk_batch_items` — bulk processing metadata and per-order results

This supports both operational checks and reconciliation.

## Test commands
```bash
npm test
```

## Assumptions
- The project uses MySQL as the persistent store for production-like behavior.
- UrbaneBolt credentials and endpoints are environment-driven and must be supplied externally.
- The actual courier payload shapes differ by partner, so internal normalization is required.
- Bulk order processing is intentionally asynchronous to keep the API responsive and avoid blocking the request thread for 100 courier calls.
- Real courier responses are translated to a normalized internal status model for consistent downstream behavior.

## Notes
- The `mockcourier` adapter exists to demonstrate extensibility and support local testing without depending on a real external courier.
- The `urbanebolt` adapter follows the token-based auth pattern supplied in the project requirement and is ready to be connected to a real UrbaneBolt UAT endpoint with valid credentials.
