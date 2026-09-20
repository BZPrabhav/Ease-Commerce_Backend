CREATE DATABASE IF NOT EXISTS ease_commerce;
USE ease_commerce;

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(255) NOT NULL,
  order_id VARCHAR(255) NOT NULL,
  courier_partner VARCHAR(100) NOT NULL,
  courier_order_id VARCHAR(255) DEFAULT NULL,
  awb_number VARCHAR(255) DEFAULT NULL,
  status VARCHAR(100) NOT NULL,
  request_payload JSON DEFAULT NULL,
  response_payload JSON DEFAULT NULL,
  error_code VARCHAR(255) DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_order_id (order_id),
  KEY idx_orders_courier_partner (courier_partner),
  KEY idx_orders_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_tracking_history (
  id VARCHAR(255) NOT NULL,
  order_id VARCHAR(255) NOT NULL,
  status VARCHAR(100) NOT NULL,
  raw_payload JSON DEFAULT NULL,
  event_time DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_tracking_order_id (order_id),
  KEY idx_order_tracking_event_time (event_time),
  CONSTRAINT fk_order_tracking_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bulk_batches (
  batch_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  total_orders INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bulk_batch_items (
  id VARCHAR(255) NOT NULL,
  batch_id VARCHAR(255) NOT NULL,
  order_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  result_payload JSON DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bulk_batch_items_batch_id (batch_id),
  CONSTRAINT fk_bulk_batch_items_batch FOREIGN KEY (batch_id) REFERENCES bulk_batches(batch_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
