const axios = require('axios');
const { BaseCourierAdapter } = require('./baseAdapter');
const { CourierApiError } = require('../errors');

class UrbaneBoltAdapter extends BaseCourierAdapter {
  constructor(config) {
    super({
      name: 'urbanebolt',
      config,
      client: { baseUrl: config.baseUrl, username: config.username, password: config.password }
    });

    this.tokenCache = { token: null, expiresAt: 0 };
  }

  async fetchToken() {
    if (this.tokenCache.token && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }

    const username = this.config.username || this.config.apiKey;
    const password = this.config.password || this.config.apiSecret;

    if (!username || !password) {
      throw new CourierApiError('Missing UrbaneBolt credentials', { courier_partner: this.name }, 401, 'AUTH_FAILED');
    }

    try {
      const url = `${this.config.baseUrl}/api/v1/auth/getToken/`;
      const response = await axios.post(url, { username, password }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      });

      const token = response.data?.token || response.data?.access || response.headers?.authorization || null;
      const ttl = 10 * 60 * 1000;
      this.tokenCache = { token, expiresAt: Date.now() + ttl };
      return token;
    } catch (error) {
      throw new CourierApiError(
        'UrbaneBolt authentication failed',
        { courier_partner: this.name, reason: error.response?.data || error.message },
        error.response?.status || 401,
        'AUTH_FAILED'
      );
    }
  }

  authHeader(token) {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async authenticate() {
    await this.fetchToken();
    return { ok: true };
  }

  async createOrder(normalizedOrder) {
    const token = await this.fetchToken();
    const payload = {
      partner_order_id: normalizedOrder.order_id,
      customer_name: normalizedOrder.customer.name,
      phone: normalizedOrder.customer.phone,
      email: normalizedOrder.customer.email,
      pickup_address: normalizedOrder.pickup_address,
      delivery_address: normalizedOrder.delivery_address,
      items: normalizedOrder.items,
      shipment: normalizedOrder.shipment
    };

    try {
      const response = await axios.post(`${this.config.baseUrl}/api/v1/manifest/`, payload, {
        headers: { ...this.authHeader(token), 'Content-Type': 'application/json' },
        timeout: 15000
      });

      const data = response.data || {};
      return {
        success: true,
        status: data.status || 'CREATED',
        courier_order_id: data.order_id || data.courier_order_id || `URB-${normalizedOrder.order_id}`,
        awb_number: data.awb_number || data.awb || data.tracking_number || `AWB-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        request_payload: payload,
        response_payload: data
      };
    } catch (error) {
      throw new CourierApiError(
        'UrbaneBolt shipment creation failed',
        { courier_partner: this.name, reason: error.response?.data || error.message },
        error.response?.status || 502,
        'COURIER_CREATE_FAILED'
      );
    }
  }

  async trackOrder(orderRef) {
    const token = await this.fetchToken();

    try {
      const response = await axios.get(`${this.config.baseUrl}/api/v1/track/`, {
        params: { order_id: orderRef.order_id, awb_number: orderRef.awb_number },
        headers: { ...this.authHeader(token), 'Content-Type': 'application/json' },
        timeout: 15000
      });

      const data = response.data || {};
      return {
        success: true,
        status: data.status || 'IN_TRANSIT',
        courier_order_id: orderRef.courier_order_id || orderRef.order_id,
        awb_number: orderRef.awb_number || data.awb_number,
        request_payload: { order_id: orderRef.order_id, awb_number: orderRef.awb_number },
        response_payload: data
      };
    } catch (error) {
      throw new CourierApiError(
        'UrbaneBolt tracking failed',
        { courier_partner: this.name, reason: error.response?.data || error.message },
        error.response?.status || 502,
        'COURIER_TRACK_FAILED'
      );
    }
  }

  async cancelOrder(orderRef) {
    const token = await this.fetchToken();
    const payload = { order_id: orderRef.order_id, awb_number: orderRef.awb_number };

    try {
      const response = await axios.post(`${this.config.baseUrl}/api/v1/cancel/`, payload, {
        headers: { ...this.authHeader(token), 'Content-Type': 'application/json' },
        timeout: 15000
      });

      const data = response.data || {};
      return {
        success: true,
        status: data.status || 'CANCELLED',
        courier_order_id: orderRef.courier_order_id || orderRef.order_id,
        awb_number: orderRef.awb_number || data.awb_number,
        request_payload: payload,
        response_payload: data
      };
    } catch (error) {
      throw new CourierApiError(
        'UrbaneBolt cancel failed',
        { courier_partner: this.name, reason: error.response?.data || error.message },
        error.response?.status || 502,
        'COURIER_CANCEL_FAILED'
      );
    }
  }
}

module.exports = { UrbaneBoltAdapter };
