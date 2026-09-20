const express = require('express');
const { ValidationError } = require('../errors');

function createOrderRouter(orderService) {
  const router = express.Router();

  router.post('/orders', async (req, res, next) => {
    try {
      const result = await orderService.createOrder(req.body, req.requestId);
      res.status(201).json({ success: true, request_id: req.requestId, data: result.data });
    } catch (error) {
      next(error);
    }
  });

  router.get('/orders/:order_id/track', async (req, res, next) => {
    try {
      const result = await orderService.trackOrder(req.params.order_id);
      res.json({ success: true, request_id: req.requestId, data: result.data });
    } catch (error) {
      next(error);
    }
  });

  router.post('/orders/:order_id/cancel', async (req, res, next) => {
    try {
      const result = await orderService.cancelOrder(req.params.order_id);
      res.json({ success: true, request_id: req.requestId, data: result.data });
    } catch (error) {
      next(error);
    }
  });

  router.get('/orders/bulk/:batch_id', async (req, res, next) => {
    try {
      const result = await orderService.getBatchStatus(req.params.batch_id);
      res.json({ success: true, request_id: req.requestId, data: result.data });
    } catch (error) {
      next(error);
    }
  });

  router.post('/orders/bulk', async (req, res, next) => {
    try {
      const result = await orderService.createBulkOrders(req.body, req.requestId);
      res.status(202).json({ success: true, request_id: req.requestId, data: result.data });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createOrderRouter };
