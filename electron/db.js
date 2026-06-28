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

        




export default db;