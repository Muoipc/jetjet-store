USE jetjet_store;

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  price INT NOT NULL COMMENT 'VNĐ, server-authoritative — KHÔNG lấy từ client',
  duration VARCHAR(50) NOT NULL DEFAULT '1 Tháng',
  description TEXT,
  features JSON,
  badge VARCHAR(100),
  image VARCHAR(500),
  stock INT NOT NULL DEFAULT 10 COMMENT 'Fixes B3: tồn kho',
  is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Fixes F5: soft delete',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_code VARCHAR(20) NOT NULL UNIQUE COMMENT 'Fixes B5: JJ+8 số thay vì orderId',
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  notes TEXT,
  total_price INT NOT NULL,
  status ENUM('pending','paid','processing','completed','cancelled') NOT NULL DEFAULT 'pending'
    COMMENT 'Fixes F3: thêm processing + cancelled',
  payment_confirmed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_order_code (order_code),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fixes F2: normalize items thay vì JSON blob
CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT DEFAULT NULL,
  product_name VARCHAR(255) NOT NULL COMMENT 'Snapshot tên lúc đặt',
  price INT NOT NULL COMMENT 'Snapshot giá lúc đặt — từ DB, KHÔNG từ client',
  quantity INT NOT NULL DEFAULT 1,
  CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_oi_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fixes F6: bcrypt hash thay plaintext key
CREATE TABLE IF NOT EXISTS admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt hash',
  display_name VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fixes F9/F12: log giao dịch webhook
CREATE TABLE IF NOT EXISTS payment_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id VARCHAR(100),
  amount INT NOT NULL,
  description TEXT,
  bank_ref VARCHAR(100),
  matched_order_id INT DEFAULT NULL,
  matched_order_code VARCHAR(20) DEFAULT NULL,
  raw_data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pl_order FOREIGN KEY (matched_order_id) REFERENCES orders(id) ON DELETE SET NULL,
  INDEX idx_matched (matched_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type ENUM('order_paid','order_delivered','order_cancelled','promo') NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  order_code VARCHAR(20),
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_unread (user_id, is_read),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
