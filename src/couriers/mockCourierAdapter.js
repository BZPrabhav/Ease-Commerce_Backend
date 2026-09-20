const { BaseCourierAdapter } = require('./baseAdapter');

class MockCourierAdapter extends BaseCourierAdapter {
  constructor(config) {
    super({
      name: 'mockcourier',
      config,
      client: { baseUrl: config.baseUrl, apiKey: config.apiKey }
    });
  }

  async authenticate() {
    return { token: `mock-${this.config.apiKey || 'demo'}` };
  }

  async createOrder(normalizedOrder) {
    return {
      success: true,
      status: 'CREATED',
      courier_order_id: `MOCK-${normalizedOrder.order_id}`,
      awb_number: `MOCK-AWB-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      request_payload: { order_id: normalizedOrder.order_id },
      response_payload: { message: 'Mock courier accepted shipment', status: 'CREATED' }
    };
  }

  async trackOrder(orderRef) {
    return {
      success: true,
      status: 'PICKED_UP',
      courier_order_id: orderRef.courier_order_id || orderRef.order_id,
      awb_number: orderRef.awb_number || 'MOCK-AWB-TRACK',
      request_payload: { order_id: orderRef.order_id },
      response_payload: { status: 'PICKED_UP' }
    };
  }

  async cancelOrder(orderRef) {
    return {
      success: true,
      status: 'CANCELLED',
      courier_order_id: orderRef.courier_order_id || orderRef.order_id,
      awb_number: orderRef.awb_number || 'MOCK-AWB-CANCEL',
      request_payload: { order_id: orderRef.order_id },
      response_payload: { cancelled: true }
    };
  }
}

module.exports = { MockCourierAdapter };
