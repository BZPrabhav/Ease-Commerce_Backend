# Design Overview

The backend is built as a courier-agnostic shipping platform. External callers do not need to understand the internal details of a third-party courier. They submit a normalized order payload with a `courier_partner` value, and the service resolves the correct adapter, validates the request, persists the order, and returns a unified response.

The current implementation is a layered Node.js/Express service with MySQL persistence, a registry-based courier selector, and a service layer that coordinates validation, persistence, and external API calls.

A key proof point of the design is that the project contains two concrete courier implementations: `urbanebolt` and a second `mockcourier` adapter. This is not just a simulation of extensibility; it is an actual plug-in example showing that a new provider can be added by implementing the same contract and registering it in the courier registry without changing the public API or service logic.

## Architecture

The application follows a layered architecture:

- Presentation layer: Express routes and middleware handle HTTP concerns such as CORS, request IDs, JSON parsing, and error responses.
- Service layer: `OrderService` contains business rules for order creation, tracking, cancellation, and bulk processing. It validates payloads, calls the appropriate courier adapter, and coordinates database writes.
- Courier layer: each courier provider is implemented as a strategy adapter. Common methods include `authenticate()`, `createOrder()`, `trackOrder()`, and `cancelOrder()`.
- Persistence layer: MySQL is used as the system of record for orders, tracking history, and bulk batch metadata.

This separation keeps the core domain logic independent from HTTP and partner-specific implementations.

## Design Patterns Used

### Strategy Pattern
Each courier (for example, `urbanebolt` and `mockcourier`) implements the same adapter contract. The service calls the same methods regardless of whose API is behind the implementation.

The `MockCourierAdapter` is an important design example because it deliberately implements the same interface as the real courier but returns deterministic, testable responses. This demonstrates that the platform is designed to work with both production-like real integrations and lightweight local/plugin implementations without changing the order service or route layer.

Why it matters:
- the API remains stable across providers
- behavior is isolated per courier
- new courier integrations do not require rewriting business logic
- test environments can plug in a fake courier without touching core flows

### Factory / Registry Pattern
The courier registry maps a string like `urbanebolt` to a concrete adapter instance. This is done centrally in the registry layer, so the service does not need hardcoded `if/else` chains.

Why it matters:
- easier extension for new providers
- cleaner validation for unsupported courier names
- less coupling between business logic and external integrations

### Repository / Data Access Pattern
The database access logic is encapsulated in a DB layer. The service reads and writes business data without embedding raw SQL across the application.

Why it matters:
- clearer responsibilities
- easier testing and maintenance
- fewer accidental database schema leaks into the service layer

## Why This Architecture

The main requirement is to support multiple courier partners without forcing the rest of the system to change every time a new one is added. A strategy-based adapter and registry make that possible with minimal churn.

The presence of a second adapter is the clearest evidence that the design is plug-in friendly: the order flow stays identical whether the request is sent to `urbanebolt` or `mockcourier`. A new provider is simply another implementation that is registered under a unique `courier_partner` key.

The layering also helps with reliability and debugging. Validation, transport, and persistence concerns are kept separate, which makes it easier to:

- add request validation rules
- swap a provider implementation
- persist full audit data for reconciliation
- handle failures consistently across all couriers

## Database Schema

The MySQL schema is intentionally small but operationally useful.

### orders
Stores the current state of each shipment.

Columns include:
- `id`: internal UUID
- `order_id`: client-facing unique order identifier
- `courier_partner`: selected courier provider
- `courier_order_id`: provider-generated shipping ID
- `awb_number`: airway bill or tracking number when available
- `status`: current shipment state
- `request_payload` and `response_payload`: raw payloads for traceability
- `error_code` and `error_message`: failure details when applicable
- `created_at`, `updated_at`: timestamps

### order_tracking_history
Append-only event stream for status changes.

Each record keeps:
- `order_id`
- `status`
- `raw_payload`
- `event_time`

This allows the system to reconstruct the order lifecycle even if the current order row is updated later.

### bulk_batches
Tracks each bulk create request and its lifecycle.

Fields include:
- `batch_id`
- `status`
- `total_orders`
- timestamps

### bulk_batch_items
Stores the result of each order inside a batch.

This gives partial success visibility when some orders fail while others succeed.

## Trade-offs

### Benefits
- Clean separation of concerns
- Easy to add courier integrations
- MySQL persistence gives durable audit history
- Unified API makes upstream systems simpler
- Bulk processing supports asynchronous scale without blocking the main request

### Costs / Limits
- A normalised internal contract must be maintained, which adds mapping logic for each courier
- Courier APIs can differ significantly in payload shape and error semantics
- Asynchronous bulk processing requires polling or status checks to retrieve results
- MySQL adds operational complexity compared with an in-memory implementation

## Summary

This design balances maintainability, extensibility, and operational visibility. The use of strategy + registry patterns makes future courier integrations straightforward, and the existence of a second `mockcourier` adapter shows the platform supports plug-in providers in practice, not just in theory. The MySQL schema preserves the real shipment lifecycle and supports debugging, reconciliation, and bulk-order workflows.
