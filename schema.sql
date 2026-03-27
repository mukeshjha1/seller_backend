-- ═══ USERS TABLE (must be created first) ═══
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(15) UNIQUE NOT NULL,
  name VARCHAR(255),
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ═══ SHOPS TABLE (linked to user) ═══
CREATE TABLE IF NOT EXISTS shops (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  name VARCHAR(255),
  category VARCHAR(100),
  area VARCHAR(255),
  phone VARCHAR(20),
  timings VARCHAR(100),
  bank VARCHAR(255),
  verified TINYINT(1) DEFAULT 0,
  verification_pending TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ═══ PRODUCTS TABLE (linked to user) ═══
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  subcategory VARCHAR(100),
  price DECIMAL(10, 2) NOT NULL,
  qty INT NOT NULL,
  description TEXT,
  image TEXT,
  colors TEXT,
  sizes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ═══ ORDERS TABLE (linked to user/shop) ═══
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  product VARCHAR(255),
  qty INT,
  buyer_area VARCHAR(255),
  address TEXT,
  amount DECIMAL(10, 2),
  status VARCHAR(50) DEFAULT 'new',
  order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ═══ OTP LOGS ═══
CREATE TABLE IF NOT EXISTS otp_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(15) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  is_verified TINYINT(1) DEFAULT 0,
  expired_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP NULL,
  ip_address VARCHAR(45),
  user_agent TEXT
);

-- ═══ LOGIN LOGS ═══
CREATE TABLE IF NOT EXISTS login_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  phone VARCHAR(15) NOT NULL,
  action VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ═══ INDEXES ═══
CREATE INDEX idx_shops_user ON shops(user_id);
CREATE INDEX idx_products_user ON products(user_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_otp_phone ON otp_logs(phone);
CREATE INDEX idx_login_phone ON login_logs(phone);
CREATE INDEX idx_login_user ON login_logs(user_id);
CREATE INDEX idx_login_action ON login_logs(action);
