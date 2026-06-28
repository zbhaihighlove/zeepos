import { app, BrowserWindow, ipcMain } from 'electron';

import db from './db.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.resolve(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    win.loadURL('http://localhost:5173');
  }

  // Temporary for debugging
  win.webContents.openDevTools();
}

// ✅ App lifecycle (important for stability)
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});


// ================= IPC =================

// 🔥 Get all products
ipcMain.handle("get-products", () => {
  return db.prepare("SELECT * FROM products").all();
});

// 🔥 Fast SKU lookup
ipcMain.handle("get-product-by-sku", (e, sku) => {
    return db.prepare(
      "SELECT * FROM products WHERE TRIM(sku) = TRIM(?)"
    ).get(sku);
  });

  ipcMain.handle("get-product-by-code", (_, code) => {
    return db.prepare(`
      SELECT *
      FROM products
      WHERE sku = ? 
         OR product_bar_code = ?
      LIMIT 1
    `).get(code, code);
  });

// 🔥 Sync products from API → local DB
ipcMain.handle("sync-products", async (event, data) => {
    try {
      console.log("🔄 SYNC STARTED");
      const user_id = data?.user_id; // 🔥 dynamic later
      const res = await fetch(
        `https://sialkotians.com/wp-json/pos/v1/products?user_id=${user_id}&nocache=${Date.now()}`,
        {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache"
          }
        }
      );
      const products = await res.json();
  
      console.log("🌐 API PRODUCTS:", products.length);
  
      const insert = db.prepare(`
        INSERT INTO products
        (sku, name, price, stock, image, unit, discount_percent, discount_fixed, product_bar_code, category_id, category_name, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = db.transaction((products) => {
        // 🔥 DELETE OLD DATA
        db.prepare("DELETE FROM products").run();

        // 🔥 INSERT NEW DATA
        for (const p of products) {
          insert.run(
            p.sku,
            p.name,
            p.price,
            p.stock,
            p.image,
            p.unit,
            p.discount_percent,
            p.discount_fixed,
            p.product_bar_code,
            p.category_id || 0,
            p.category_name || "",
            p.description || ""
          );
        }
      });
  
      transaction(products);
  
      // 🔥 VERIFY
      const count = db.prepare("SELECT COUNT(*) as c FROM products").get().c;
      console.log("✅ DB COUNT AFTER SYNC:", count);
  
      return { success: true, count };
  
    } catch (e) {
      console.log("❌ Sync failed:", e.message);
      return { success: false, message: e.message };
    }
  });

// orders 

  ipcMain.handle("save-order", (e, order) => {

    const insertOrder = db.prepare(`
      INSERT INTO orders 
      (total, tax, discount, discount_percent, tax_percent, received, change_amount, customer_name, customer_phone, status, created_at, store_id, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), ?, ?)
    `);
  
    const insertItem = db.prepare(`
      INSERT INTO order_items
      (order_id, product_name, sku, price, qty, discount_percent, discount_fixed, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
  
    const transaction = db.transaction((order) => {
  
      const result = insertOrder.run(
        order.total,
        order.tax,
        order.discount,
        order.discountPercent || 0,
        order.taxPercent || 0,
        order.received || 0,
        order.change || 0,
        order.customer.name,
        order.customer.phone,
        order.store_id, // ✅
  order.user_id   // ✅
      );
  
      const orderId = result.lastInsertRowid;
  
      for (const item of order.items) {
  
        // ✅ Correct calculation with discount
        const base = item.price * item.qty;
        const percent = (base * (item.itemDiscountPercent || 0)) / 100;
        const total = base - (percent + (item.itemDiscountFixed || 0));
  
        insertItem.run(
          orderId,
          item.name,
          item.sku,
          item.price,
          item.qty,
          item.itemDiscountPercent || 0,
          item.itemDiscountFixed || 0,
          total
        );

        // 🔥 UPDATE STOCK
        updateStock.run(item.qty, item.qty, item.sku);
      }
  
    });
  
    transaction(order);
  
    return { success: true };
  });


  ipcMain.handle("print-bill", async (event, html) => {
    try {
      const printWindow = new BrowserWindow({
        show: false
      });
  
      await printWindow.loadURL(
        "data:text/html;charset=utf-8," + encodeURIComponent(html)
      );
  
      printWindow.webContents.print({}, (success, errorType) => {
        if (!success) {
          console.log("❌ Print failed:", errorType);
        }
      });
  
      return { success: true };
  
    } catch (err) {
      console.log("❌ Print error:", err.message);
      return { success: false };
    }
  });

  ipcMain.handle("sync-stock", async (_, data) => {

    const response = await fetch(
      "https://sialkotians.com/wp-json/pos/v1/sync-stock",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          user_id: data.user_id
        })
      }
    );
  
    return await response.json();
  });


  ipcMain.handle("get-orders", () => {
    return db.prepare(`
      SELECT * FROM orders ORDER BY id DESC
    `).all();
  });
  
  ipcMain.handle("get-order-items", (e, orderId) => {
    return db.prepare(`
      SELECT * FROM order_items WHERE order_id=?
    `).all(orderId);
  });


  ipcMain.handle("sync-orders", async () => {
    try {
      const orders = db.prepare(`
        SELECT * FROM orders WHERE status='pending'
      `).all();
  
      for (const order of orders) {
        const items = db.prepare(`
          SELECT * FROM order_items WHERE order_id=?
        `).all(order.id);
  
        const payload = {
          ...order,
          items
        };
  
        try {
          const res = await fetch(
            `https://sialkotians.com/wp-json/pos/v1/order?nocache=${Date.now()}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify(payload)
            }
          );
  
          const result = await res.json();
  
          if (result.success) {
            db.prepare(`
              UPDATE orders SET status='synced' WHERE id=?
            `).run(order.id);
  
            console.log("✅ Synced order:", order.id);
          }
  
        } catch (err) {
          console.log("❌ Failed order:", order.id);
        }
      }
  
      return { success: true };
  
    } catch (err) {
      console.log("Sync error:", err.message);
      return { success: false };
    }
  });



  ipcMain.handle("get-order-by-id", (event, id) => {
    try {
      const order = db.prepare(
        "SELECT * FROM orders WHERE id = ?"
      ).get(id);
  
      const items = db.prepare(
        "SELECT * FROM order_items WHERE order_id = ?"
      ).all(id);
  
      if (!order) return null;

return {
  ...order,
  items
};
    } catch (err) {
      console.error("get-order-by-id error:", err);
      return null;
    }
  });


  ipcMain.handle("update-order-full", (e, order) => {

    const transaction = db.transaction((order) => {
  
      // ✅ 1. GET OLD ITEMS
      const oldItems = db.prepare(`
        SELECT sku, qty FROM order_items WHERE order_id = ?
      `).all(order.id);
  
      // ✅ 2. RESTORE STOCK FROM OLD ITEMS
      const restoreStock = db.prepare(`
        UPDATE products 
        SET stock = stock + ?
        WHERE sku = ?
      `);
  
      for (const item of oldItems) {
        restoreStock.run(item.qty, item.sku);
      }
  
      // ✅ 3. UPDATE ORDER
      db.prepare(`
        UPDATE orders 
        SET total = ?, 
            tax = ?, 
            discount = ?, 
            discount_percent = ?, 
            tax_percent = ?, 
            received = ?, 
            change_amount = ?, 
            customer_name = ?, 
            customer_phone = ?,
            store_id = ?,
      user_id = ?
        WHERE id = ?
      `).run(
        order.total,
        order.tax,
        order.discount,
        order.discountPercent || 0,
        order.taxPercent || 0,
        order.received || 0,
        order.change || 0,
        order.customer?.name || "",
        order.customer?.phone || "",
        order.store_id,   // ✅
  order.user_id,    // ✅
        order.id
      );
  
      // ✅ 4. DELETE OLD ITEMS
      db.prepare("DELETE FROM order_items WHERE order_id = ?").run(order.id);
  
      // ✅ 5. PREPARE INSERT + STOCK UPDATE
      const insert = db.prepare(`
        INSERT INTO order_items
        (order_id, product_name, sku, price, qty, discount_percent, discount_fixed, total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
  
      const updateStock = db.prepare(`
        UPDATE products 
        SET stock = CASE 
          WHEN stock >= ? THEN stock - ?
          ELSE 0
        END
        WHERE sku = ?
      `);
  
      // ✅ 6. INSERT NEW ITEMS + DEDUCT STOCK
      for (const item of order.items) {
  
        const base = item.price * item.qty;
        const percent = (base * (item.itemDiscountPercent || 0)) / 100;
        const totalItem = base - (percent + (item.itemDiscountFixed || 0));
  
        insert.run(
          order.id,
          item.name,
          item.sku,
          item.price,
          item.qty,
          item.itemDiscountPercent || 0,
          item.itemDiscountFixed || 0,
          totalItem
        );
  
        // 🔥 deduct new stock
        updateStock.run(item.qty, item.qty, item.sku);
      }
  
    });
  
    transaction(order);
  
    return true;
  });

  ipcMain.handle("get-order-stats", () => {
    const today = db.prepare(`
      SELECT COUNT(*) as count, 
             SUM(total) as amount 
      FROM orders 
      WHERE DATE(created_at) = DATE('now')
    `).get();
  
    const unitsToday = db.prepare(`
      SELECT SUM(oi.qty) as units 
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE DATE(o.created_at) = DATE('now')
    `).get();
  
    const month = db.prepare(`
      SELECT COUNT(*) as count, 
             SUM(total) as amount 
      FROM orders 
      WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
    `).get();
  
    const unitsMonth = db.prepare(`
      SELECT SUM(oi.qty) as units 
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE strftime('%Y-%m', o.created_at) = strftime('%Y-%m', 'now')
    `).get();
  
    const year = db.prepare(`
      SELECT COUNT(*) as count, 
             SUM(total) as amount 
      FROM orders 
      WHERE strftime('%Y', created_at) = strftime('%Y', 'now')
    `).get();
  
    const unitsYear = db.prepare(`
      SELECT SUM(oi.qty) as units 
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE strftime('%Y', o.created_at) = strftime('%Y', 'now')
    `).get();
  
    return {
      today: today?.count || 0,
      todayAmount: today?.amount || 0,
      todayUnits: unitsToday?.units || 0,
  
      month: month?.count || 0,
      monthAmount: month?.amount || 0,
      monthUnits: unitsMonth?.units || 0,
  
      year: year?.count || 0,
      yearAmount: year?.amount || 0,
      yearUnits: unitsYear?.units || 0,
    };
  });

  const updateStock = db.prepare(`
    UPDATE products 
SET stock = CASE 
  WHEN stock >= ? THEN stock - ?
  ELSE 0
END
WHERE sku = ?
  `);