import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';

const dbPath = path.join(app.getPath('userData'), 'pos.db');

console.log('Database Path:', dbPath);

const db = new Database(dbPath);

db.prepare(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  stock INTEGER DEFAULT 0,
  image TEXT,
  sku TEXT UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
)
`).run();

// Safe migration
try {
  db.prepare(`ALTER TABLE products ADD COLUMN unit TEXT`).run();
} catch (e) {}

try {
  db.prepare(`ALTER TABLE products ADD COLUMN discount_percent INTEGER`).run();
} catch (e) {}

try {
  db.prepare(`ALTER TABLE products ADD COLUMN discount_fixed INTEGER`).run();
} catch (e) {}

try {
  db.prepare(`ALTER TABLE products ADD COLUMN product_bar_code INTEGER`).run();
} catch (e) {}

try {
  db.prepare(`ALTER TABLE products ADD COLUMN category_id INTEGER DEFAULT 0`).run();
} catch (e) {}

try {
  db.prepare(`ALTER TABLE products ADD COLUMN category_name TEXT`).run();
} catch (e) {}

try {
  db.prepare(`ALTER TABLE products ADD COLUMN description TEXT`).run();
} catch (e) {}

try {
  db.prepare(`ALTER TABLE products ADD COLUMN purchase_price REAL DEFAULT 0`).run();
} catch (e) {}

db.prepare(`CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)`).run();


// orders

db.prepare(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total REAL,
      tax REAL,
      discount REAL,
      customer_name TEXT,
      customer_phone TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    `).run();

    try {
      db.prepare(`ALTER TABLE orders ADD COLUMN discount_percent REAL DEFAULT 0`).run();
    } catch (e) {}
    
    try {
      db.prepare(`ALTER TABLE orders ADD COLUMN tax_percent REAL DEFAULT 0`).run();
    } catch (e) {}
    
    try {
      db.prepare(`ALTER TABLE orders ADD COLUMN received REAL DEFAULT 0`).run();
    } catch (e) {}
    
    try {
      db.prepare(`ALTER TABLE orders ADD COLUMN change_amount REAL DEFAULT 0`).run();
    } catch (e) {}

    try {
      db.prepare(`
        ALTER TABLE orders ADD COLUMN created_at TEXT
      `).run();
    } catch (e) {}

    try {
      db.prepare(`
        ALTER TABLE orders ADD COLUMN store_id INTEGER;
      `).run();
    } catch (e) {}

    try {
      db.prepare(`
        ALTER TABLE orders ADD COLUMN user_id INTEGER;
      `).run();
    } catch (e) {}

    try {
      db.prepare(`ALTER TABLE orders ADD COLUMN customer_id INTEGER`).run();
    } catch (e) {}

    try {
      db.prepare(`ALTER TABLE orders ADD COLUMN remote_id INTEGER`).run();
    } catch (e) {}





    db.prepare(`
        CREATE TABLE IF NOT EXISTS order_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER,
          product_name TEXT,
          sku TEXT,
          price REAL,
          qty INTEGER,
          discount_percent REAL DEFAULT 0,
          discount_fixed REAL DEFAULT 0,
          total REAL
        )
        `).run();

    try {
      db.prepare(`ALTER TABLE order_items ADD COLUMN purchase_price REAL DEFAULT 0`).run();
    } catch (e) {}

// customers & credit

db.prepare(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
  )
`).run();

try {
  db.prepare(`ALTER TABLE customers ADD COLUMN synced INTEGER DEFAULT 0`).run();
} catch (e) {}

db.prepare(`CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS credit_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    note TEXT,
    store_id INTEGER,
    user_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`).run();

try {
  db.prepare(`ALTER TABLE credit_payments ADD COLUMN remote_id INTEGER`).run();
} catch (e) {}

try {
  db.prepare(`ALTER TABLE credit_payments ADD COLUMN synced INTEGER DEFAULT 0`).run();
} catch (e) {}

db.prepare(`CREATE INDEX IF NOT EXISTS idx_credit_payments_customer ON credit_payments(customer_id)`).run();

// returns

db.prepare(`
  CREATE TABLE IF NOT EXISTS returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    order_item_id INTEGER NOT NULL,
    sku TEXT,
    product_name TEXT,
    qty INTEGER NOT NULL,
    refund_amount REAL NOT NULL,
    applied_to_credit REAL DEFAULT 0,
    cash_refund REAL DEFAULT 0,
    reason TEXT,
    store_id INTEGER,
    user_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`).run();

try {
  db.prepare(`ALTER TABLE returns ADD COLUMN synced INTEGER DEFAULT 0`).run();
} catch (e) {}

db.prepare(`CREATE INDEX IF NOT EXISTS idx_returns_order ON returns(order_id)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_returns_order_item ON returns(order_item_id)`).run();

// expenses (pulled down from the server — entered only via the mobile app)

db.prepare(`
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    remote_id INTEGER,
    description TEXT,
    amount REAL DEFAULT 0,
    created_at TEXT
  )
`).run();

db.prepare(`CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at)`).run();

// app_meta: small key/value store for local app state that must survive a logout
// (e.g. remembering which account was last logged in, to detect an account switch)
db.prepare(`
  CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`).run();


export default db;