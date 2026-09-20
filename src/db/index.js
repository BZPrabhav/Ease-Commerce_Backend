const { config } = require('../config');

async function createDatabase(options = {}) {
  const client = (options.client || config.dbClient || 'mysql').toLowerCase();

  if (client !== 'mysql') {
    throw new Error('This application requires MySQL. Remove non-MySQL database configuration.');
  }

  const mysql = require('mysql2/promise');

  const rootConnection = await mysql.createConnection({
    host: options.host || config.dbHost,
    port: options.port || config.dbPort,
    user: options.user || config.dbUser,
    password: options.password || config.dbPassword,
    multipleStatements: true
  });

  const dbName = options.database || config.dbName;
  await rootConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await rootConnection.end();

  const connection = await mysql.createConnection({
    host: options.host || config.dbHost,
    port: options.port || config.dbPort,
    user: options.user || config.dbUser,
    password: options.password || config.dbPassword,
    database: dbName,
    waitForConnections: true,
    connectionLimit: 10
  });

  await connection.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(255) PRIMARY KEY,
      order_id VARCHAR(255) NOT NULL UNIQUE,
      courier_partner VARCHAR(100) NOT NULL,
      courier_order_id VARCHAR(255),
      awb_number VARCHAR(255),
      status VARCHAR(100) NOT NULL,
      request_payload JSON,
      response_payload JSON,
      error_code VARCHAR(255),
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS order_tracking_history (
      id VARCHAR(255) PRIMARY KEY,
      order_id VARCHAR(255) NOT NULL,
      status VARCHAR(100) NOT NULL,
      raw_payload JSON,
      event_time DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS bulk_batches (
      batch_id VARCHAR(255) PRIMARY KEY,
      status VARCHAR(50) NOT NULL,
      total_orders INT NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS bulk_batch_items (
      id VARCHAR(255) PRIMARY KEY,
      batch_id VARCHAR(255) NOT NULL,
      order_id VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL,
      result_payload JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return {
    type: 'mysql',
    connection,
    async initialize() { return this; },
    async findOrderByOrderId(orderId) {
      const [rows] = await connection.query('SELECT * FROM orders WHERE order_id = ?', [String(orderId)]);
      return rows[0] || null;
    },
    async saveOrder(order) {
      await connection.query(
        'INSERT INTO orders (id, order_id, courier_partner, courier_order_id, awb_number, status, request_payload, response_payload, error_code, error_message, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE courier_partner = VALUES(courier_partner), courier_order_id = VALUES(courier_order_id), awb_number = VALUES(awb_number), status = VALUES(status), request_payload = VALUES(request_payload), response_payload = VALUES(response_payload), error_code = VALUES(error_code), error_message = VALUES(error_message), updated_at = NOW()',
        [order.id, order.order_id, order.courier_partner, order.courier_order_id || null, order.awb_number || null, order.status, JSON.stringify(order.request_payload || {}), JSON.stringify(order.response_payload || {}), order.error_code || null, order.error_message || null]
      );
      return order;
    },
    async updateOrder(orderId, updates) {
      const current = await this.findOrderByOrderId(orderId);
      if (!current) return null;
      const merged = { ...current, ...updates };
      await connection.query(
        'UPDATE orders SET courier_partner = ?, courier_order_id = ?, awb_number = ?, status = ?, request_payload = ?, response_payload = ?, error_code = ?, error_message = ?, updated_at = NOW() WHERE order_id = ?',
        [merged.courier_partner, merged.courier_order_id || null, merged.awb_number || null, merged.status, JSON.stringify(merged.request_payload || {}), JSON.stringify(merged.response_payload || {}), merged.error_code || null, merged.error_message || null, String(orderId)]
      );
      return merged;
    },
    async addTrackingEvent(event) {
      await connection.query(
        'INSERT INTO order_tracking_history (id, order_id, status, raw_payload, event_time, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [event.id, event.order_id, event.status, JSON.stringify(event.raw_payload || {}), event.event_time]
      );
      return event;
    },
    async getTrackingHistory(orderId) {
      const [rows] = await connection.query('SELECT * FROM order_tracking_history WHERE order_id = ? ORDER BY event_time ASC', [String(orderId)]);
      return rows;
    },
    async saveBatchResult(batchId, result) {
      await connection.query(
        'INSERT INTO bulk_batches (batch_id, status, total_orders, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE status = VALUES(status), total_orders = VALUES(total_orders), updated_at = NOW()',
        [batchId, result.status, result.total || 0]
      );
      return result;
    },
    async getBatchResult(batchId) {
      const [rows] = await connection.query('SELECT * FROM bulk_batches WHERE batch_id = ?', [batchId]);
      return rows[0] || null;
    }
  };
}

module.exports = {
  createDatabase
};
