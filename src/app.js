const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('node:crypto');

const { config } = require('./config');
const { normalizeError } = require('./errors');
const { createCourierRegistry } = require('./couriers/registry');
const { OrderService } = require('./services/orderService');
const { createOrderRouter } = require('./routes/orderRoutes');

function createApp({ db, courierRegistry = createCourierRegistry(config) } = {}) {
  if (!db) {
    throw new Error('MySQL database instance is required.');
  }

  const app = express();
  const orderService = new OrderService({ db, courierRegistry });

  app.use(cors());
  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('x-request-id', req.requestId);
    next();
  });

  app.get('/health', (req, res) => {
    res.json({ success: true, data: { status: 'ok' }, request_id: req.requestId });
  });

  app.use('/api/v1', createOrderRouter(orderService));

  app.use((err, req, res, next) => {
    const response = normalizeError(err, req.requestId);
    res.status(response.error.status || 500).json(response);
  });

  return app;
}

module.exports = { createApp };
