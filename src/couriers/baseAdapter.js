class BaseCourierAdapter {
  constructor({ name, config, client }) {
    this.name = name;
    this.config = config || {};
    this.client = client;
  }

  async authenticate() {
    return { ok: true };
  }

  async createOrder() {
    throw new Error(`${this.name} createOrder not implemented`);
  }

  async trackOrder() {
    throw new Error(`${this.name} trackOrder not implemented`);
  }

  async cancelOrder() {
    throw new Error(`${this.name} cancelOrder not implemented`);
  }
}

module.exports = { BaseCourierAdapter };
