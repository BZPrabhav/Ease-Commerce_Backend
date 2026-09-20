const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');

function createFakeDb() {
  const orders = new Map();
  const tracking = [];
  const batches = new Map();

  return {
    async findOrderByOrderId(orderId) {
      return orders.get(String(orderId)) || null;
    },
    async saveOrder(order) {
      orders.set(String(order.order_id), order);
      return order;
    },
    async updateOrder(orderId, updates) {
      const current = orders.get(String(orderId));
      if (!current) return null;
      const merged = { ...current, ...updates };
      orders.set(String(orderId), merged);
      return merged;
    },
    async addTrackingEvent(event) {
      tracking.push(event);
      return event;
    },
    async getTrackingHistory(orderId) {
      return tracking.filter((event) => event.order_id === String(orderId));
    },
    async saveBatchResult(batchId, result) {
      batches.set(batchId, result);
      return result;
    },
    async getBatchResult(batchId) {
      return batches.get(batchId) || null;
    }
  };
}

async function makeRequest(app, method, path, body) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;

  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  return { status: res.status, data };
}

test('POST /api/v1/orders creates an order and returns normalized response', async () => {
  const app = createApp({ db: createFakeDb() });
  const payload = {
    order_id: 'ORD-1001',
    courier_partner: 'urbanebolt',
    customer: {
      name: 'Jane Doe',
      phone: '9999999999',
      email: 'jane@example.com'
    },
    pickup_address: {
      name: 'Seller',
      address_line_1: '10 Market Rd',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      country: 'IN'
    },
    delivery_address: {
      name: 'Jane Doe',
      address_line_1: '22 Residency Rd',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560002',
      country: 'IN'
    },
    items: [{ sku: 'SKU-1', name: 'T-shirt', quantity: 1, price: 499 }],
    shipment: {
      weight_kg: 0.5,
      declared_value: 499
    }
  };

  const result = await makeRequest(app, 'POST', '/api/v1/orders', payload);
  assert.equal(result.status, 201);
  assert.equal(result.data.success, true);
  assert.equal(result.data.data.order_id, 'ORD-1001');
  assert.equal(result.data.data.courier_partner, 'urbanebolt');
});

test('POST /api/v1/orders rejects unknown courier partner', async () => {
  const app = createApp({ db: createFakeDb() });
  const payload = {
    order_id: 'ORD-1002',
    courier_partner: 'unknown-courier',
    customer: {
      name: 'Jane Doe',
      phone: '9999999999',
      email: 'jane@example.com'
    },
    pickup_address: { name: 'Seller', address_line_1: '10 Market Rd', city: 'Bengaluru', state: 'Karnataka', pincode: '560001', country: 'IN' },
    delivery_address: { name: 'Jane Doe', address_line_1: '22 Residency Rd', city: 'Bengaluru', state: 'Karnataka', pincode: '560002', country: 'IN' },
    items: [{ sku: 'SKU-1', name: 'T-shirt', quantity: 1, price: 499 }],
    shipment: { weight_kg: 0.5, declared_value: 499 }
  };

  const result = await makeRequest(app, 'POST', '/api/v1/orders', payload);
  assert.equal(result.status, 400);
  assert.equal(result.data.success, false);
  assert.equal(result.data.error.code, 'INVALID_COURIER_PARTNER');
});
