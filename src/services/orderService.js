const crypto = require('node:crypto');
const { ValidationError, CourierApiError } = require('../errors');
const { logger } = require('../logger');
const { config } = require('../config');

function mysqlDateTime(date = new Date()) {
  return new Date(date).toISOString().slice(0, 19).replace('T', ' ');
}

class OrderService {
  constructor({ db, courierRegistry }) {
    this.db = db;
    this.courierRegistry = courierRegistry;
  }

  normalizeOrderPayload(payload, requestId) {
    if (!payload || typeof payload !== 'object') {
      throw new ValidationError('Invalid payload', { field: 'body' });
    }

    if (!payload.order_id) {
      throw new ValidationError('order_id is required', { field: 'order_id' });
    }

    if (!payload.courier_partner) {
      throw new ValidationError('courier_partner is required', { field: 'courier_partner' });
    }

    if (!payload.customer || !payload.customer.name || !payload.customer.phone) {
      throw new ValidationError('customer.name and customer.phone are required', { field: 'customer' });
    }

    if (!payload.pickup_address || !payload.delivery_address) {
      throw new ValidationError('pickup_address and delivery_address are required', { fields: ['pickup_address', 'delivery_address'] });
    }

    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw new ValidationError('items must be a non-empty array', { field: 'items' });
    }

    const normalized = {
      id: crypto.randomUUID(),
      order_id: String(payload.order_id),
      courier_partner: String(payload.courier_partner).trim().toLowerCase(),
      customer: payload.customer,
      pickup_address: payload.pickup_address,
      delivery_address: payload.delivery_address,
      items: payload.items,
      shipment: payload.shipment || {},
      status: 'CREATED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      request_id: requestId
    };

    return normalized;
  }

  async ensureOrderDoesNotExist(orderId) {
    const existing = await this.db.findOrderByOrderId(orderId);
    if (existing) {
      throw new ValidationError('An order with this order_id already exists', { field: 'order_id' });
    }
  }

  async createOrder(payload, requestId = 'unknown') {
    const normalizedOrder = this.normalizeOrderPayload(payload, requestId);
    const adapter = this.courierRegistry.getAdapter(normalizedOrder.courier_partner);

    await this.ensureOrderDoesNotExist(normalizedOrder.order_id);

    await adapter.authenticate();
    const courierResult = await adapter.createOrder(normalizedOrder);

    const saved = await this.db.saveOrder({
      id: normalizedOrder.id,
      order_id: normalizedOrder.order_id,
      courier_partner: normalizedOrder.courier_partner,
      courier_order_id: courierResult.courier_order_id,
      awb_number: courierResult.awb_number,
      status: courierResult.status,
      request_payload: courierResult.request_payload,
      response_payload: courierResult.response_payload,
      created_at: normalizedOrder.created_at,
      updated_at: normalizedOrder.updated_at,
      error_code: null,
      error_message: null
    });

    await this.db.addTrackingEvent({
      id: crypto.randomUUID(),
      order_id: normalizedOrder.order_id,
      status: courierResult.status,
      raw_payload: courierResult.response_payload,
      event_time: mysqlDateTime(new Date())
    });

    return {
      success: true,
      data: {
        id: saved.id,
        order_id: saved.order_id,
        courier_partner: saved.courier_partner,
        courier_order_id: saved.courier_order_id,
        awb_number: saved.awb_number,
        status: saved.status,
        created_at: saved.created_at,
        updated_at: saved.updated_at
      }
    };
  }

  async trackOrder(orderId) {
    const order = await this.db.findOrderByOrderId(orderId);
    if (!order) {
      throw new ValidationError('Order not found', { order_id: orderId });
    }

    const adapter = this.courierRegistry.getAdapter(order.courier_partner);
    const result = await adapter.trackOrder(order);

    await this.db.updateOrder(order.order_id, {
      status: result.status,
      response_payload: result.response_payload,
      updated_at: mysqlDateTime(new Date())
    });

    await this.db.addTrackingEvent({
      id: crypto.randomUUID(),
      order_id: order.order_id,
      status: result.status,
      raw_payload: result.response_payload,
      event_time: mysqlDateTime(new Date())
    });

    return {
      success: true,
      data: {
        order_id: order.order_id,
        courier_partner: order.courier_partner,
        courier_order_id: order.courier_order_id,
        awb_number: order.awb_number,
        status: result.status
      }
    };
  }

  async cancelOrder(orderId) {
    const order = await this.db.findOrderByOrderId(orderId);
    if (!order) {
      throw new ValidationError('Order not found', { order_id: orderId });
    }

    const adapter = this.courierRegistry.getAdapter(order.courier_partner);
    const result = await adapter.cancelOrder(order);

    await this.db.updateOrder(order.order_id, {
      status: result.status,
      response_payload: result.response_payload,
      updated_at: mysqlDateTime(new Date())
    });

    await this.db.addTrackingEvent({
      id: crypto.randomUUID(),
      order_id: order.order_id,
      status: result.status,
      raw_payload: result.response_payload,
      event_time: mysqlDateTime(new Date())
    });

    return {
      success: true,
      data: {
        order_id: order.order_id,
        status: result.status,
        courier_partner: order.courier_partner
      }
    };
  }

  async createBulkOrders(payload, requestId = 'unknown') {
    if (!Array.isArray(payload.orders) || payload.orders.length === 0) {
      throw new ValidationError('orders must be a non-empty array', { field: 'orders' });
    }

    if (payload.orders.length > 100) {
      throw new ValidationError('Maximum 100 orders per batch', { field: 'orders' });
    }

    const batchId = crypto.randomUUID();
    const batch = { batch_id: batchId, status: 'processing', total: payload.orders.length, results: [] };

    this.db.saveBatchResult(batchId, batch);

    setImmediate(async () => {
      try {
        const results = await Promise.all(
          payload.orders.map(async (orderPayload) => {
            try {
              const result = await this.createOrder(orderPayload, requestId);
              return { success: true, order_id: orderPayload.order_id, data: result.data };
            } catch (error) {
              logger.error('Bulk order failed', { order_id: orderPayload.order_id, courier_partner: orderPayload.courier_partner, request_id: requestId, error: error.message, stack: error.stack });
              return { success: false, order_id: orderPayload.order_id, reason: error.message || 'Unknown error', code: error.code || 'BULK_ORDER_FAILED' };
            }
          })
        );

        const finalBatchResult = {
          batch_id: batchId,
          status: 'completed',
          total: payload.orders.length,
          results
        };

        await this.db.saveBatchResult(batchId, finalBatchResult);
      } catch (error) {
        logger.error('Bulk batch failed', { batch_id: batchId, request_id: requestId, error: error.message, stack: error.stack });
        await this.db.saveBatchResult(batchId, {
          batch_id: batchId,
          status: 'failed',
          total: payload.orders.length,
          error: error.message
        });
      }
    });

    return {
      success: true,
      data: {
        batch_id: batchId,
        status: 'processing',
        total: payload.orders.length
      }
    };
  }

  async getBatchStatus(batchId) {
    const result = await this.db.getBatchResult(batchId);
    if (!result) {
      throw new ValidationError('Batch not found', { batch_id: batchId });
    }

    return {
      success: true,
      data: result
    };
  }
}

module.exports = { OrderService };
