const { config } = require('../config');
const { CourierValidationError } = require('../errors');
const { UrbaneBoltAdapter } = require('./urbaneboltAdapter');
const { MockCourierAdapter } = require('./mockCourierAdapter');

class CourierRegistry {
  constructor(adapterMap = {}) {
    this.adapterMap = adapterMap;
  }

  getSupportedCouriers() {
    return Object.keys(this.adapterMap);
  }

  getAdapter(name) {
    const key = String(name || '').trim().toLowerCase();
    if (!this.adapterMap[key]) {
      throw new CourierValidationError('Unknown courier partner', {
        supported_couriers: this.getSupportedCouriers()
      });
    }
    return this.adapterMap[key];
  }
}

function createCourierRegistry(runtimeConfig = config) {
  const adapterMap = {
    urbanebolt: new UrbaneBoltAdapter(runtimeConfig.courier.urbanebolt),
    mockcourier: new MockCourierAdapter(runtimeConfig.courier.mockcourier)
  };

  return new CourierRegistry(adapterMap);
}

module.exports = { CourierRegistry, createCourierRegistry };
