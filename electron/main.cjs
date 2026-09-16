const { app, BrowserWindow, ipcMain } = require('electron');

const db = require('./db.cjs');

const path = require('path');
const https = require('https');
const { URL } = require('url');

// Electron 22 bundles Node 16, which has no global fetch (added in Node 18+).
// This app only ever calls fetch(url, { method, headers, body }) and reads
// res.json(), so a minimal polyfill over Node's built-in https module covers
// every call site in this file without changing any of them.
if (typeof global.fetch === 'undefined') {
  global.fetch = function simpleFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
      const u = new URL(url);
      const req = https.request(
        {
          hostname: u.hostname,
          path: u.pathname + u.search,
          method: options.method || 'GET',
          headers: options.headers || {},
        },
        (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              json: async () => JSON.parse(data),
              text: async () => data,
            });
          });
        }
      );
      req.on('error', reject);
      if (options.body) req.write(options.body);
      req.end();
    });
  };
}

let mainWindow;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.resolve(__dirname, 'preload.cjs'),
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


// ================= CUSTOMERS / CREDIT HELPERS =================

function findOrCreateCustomer(name, phone) {
  const cleanPhone = (phone || "").trim();
  if (!cleanPhone) return null;

  const existing = db.prepare("SELECT id FROM customers WHERE phone = ?").get(cleanPhone);

  if (existing) {
    db.prepare("UPDATE customers SET name = ?, updated_at = datetime('now'), synced = 0 WHERE id = ?")
      .run((name || "").trim(), existing.id);
    return existing.id;
  }

  const result = db.prepare(
    "INSERT INTO customers (name, phone, updated_at, synced) VALUES (?, ?, datetime('now'), 0)"
  ).run((name || "").trim(), cleanPhone);

  return result.lastInsertRowid;
}

function getCustomerBalance(customerId) {
  const due = db.prepare(
    "SELECT COALESCE(SUM(total - received), 0) as due FROM orders WHERE customer_id = ?"
  ).get(customerId).due;

  const paid = db.prepare(
    "SELECT COALESCE(SUM(amount), 0) as paid FROM credit_payments WHERE customer_id = ?"
  ).get(customerId).paid;

  const returnsCredit = db.prepare(
    "SELECT COALESCE(SUM(applied_to_credit), 0) as c FROM returns WHERE order_id IN (SELECT id FROM orders WHERE customer_id = ?)"
  ).get(customerId).c;

  return due - paid - returnsCredit;
}

function getPurchasePrice(sku) {
  const row = db.prepare("SELECT purchase_price FROM products WHERE sku = ?").get(sku);
  return row?.purchase_price || 0;
}

// Human-facing receipt id, generated client-side (same scheme duplicated in mobile's
// POSContext.js) so an order placed on either device gets the identical identifier
// wherever it's printed or looked up — no server round-trip needed to assign it.
function generateOrderNumber() {
  const now = new Date();
  const pad = (n, len = 2) => String(n).padStart(len, "0");
  const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `ORD-${datePart}-${timePart}-${rand}`;
}

// Pulls down any credit payment recorded elsewhere (mobile, or another desktop) that
// this device doesn't already have — either because it's one WE pushed (matched via
// local_id) or one already pulled down before (matched via remote_id).
async function pullDownCreditPayments(userId) {
  if (!userId) return 0;

  try {
    const res = await fetch(
      `https://sialkotians.com/wp-json/pos/v1/credit-payments?user_id=${userId}&nocache=${Date.now()}`,
      { cache: "no-store", headers: { "Cache-Control": "no-cache" } }
    );
    const remotePayments = await res.json();

    if (!Array.isArray(remotePayments)) {
      console.log("❌ Pull credit payments: unexpected response", remotePayments);
      return 0;
    }

    let pulledCount = 0;

    for (const rp of remotePayments) {
      if (rp.local_id) {
        const ownRow = db.prepare("SELECT id FROM credit_payments WHERE id = ?").get(rp.local_id);
        if (ownRow) continue; // this is our own pushed payment, already accounted for
      }

      const alreadyPulled = db.prepare("SELECT id FROM credit_payments WHERE remote_id = ?").get(rp.id);
      if (alreadyPulled) continue;

      const customerId = findOrCreateCustomer(rp.customer_name, rp.customer_phone);
      if (!customerId) continue;

      db.prepare(`
        INSERT INTO credit_payments (customer_id, amount, note, created_at, remote_id, synced)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(customerId, rp.amount, rp.note || "", rp.created_at, rp.id);

      pulledCount++;
    }

    if (pulledCount > 0) {
      console.log(`✅ Pulled ${pulledCount} new credit payment(s) from server`);
    }

    return pulledCount;

  } catch (err) {
    console.log("❌ Pull credit payments failed:", err.message);
    return 0;
  }
}

// Pulls down any order placed elsewhere (mobile, or another desktop) that this device
// doesn't already have — either because it's one WE pushed (matched via local_id) or
// one already pulled down before (matched via remote_id). Stock is deliberately NOT
// deducted here — stock truth flows from the server via the existing sync-products
// pull, so deducting locally too would double-count until that next sync overwrites it.
async function pullDownOrders(userId) {
  if (!userId) return 0;

  try {
    const res = await fetch(
      `https://sialkotians.com/wp-json/pos/v1/all-orders?user_id=${userId}&nocache=${Date.now()}`,
      { cache: "no-store", headers: { "Cache-Control": "no-cache" } }
    );
    const remoteOrders = await res.json();

    if (!Array.isArray(remoteOrders)) {
      console.log("❌ Pull orders: unexpected response", remoteOrders);
      return 0;
    }

    const insertOrder = db.prepare(`
      INSERT INTO orders
      (total, tax, discount, discount_percent, tax_percent, received, change_amount, customer_name, customer_phone, customer_id, status, created_at, remote_id, order_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?, ?)
    `);

    const insertItem = db.prepare(`
      INSERT INTO order_items
      (order_id, product_name, sku, price, qty, discount_percent, discount_fixed, total, purchase_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let pulledCount = 0;

    for (const ro of remoteOrders) {
      if (ro.local_id) {
        const ownRow = db.prepare("SELECT id FROM orders WHERE id = ?").get(ro.local_id);
        if (ownRow) continue; // this is our own pushed order, already accounted for
      }

      const alreadyPulled = db.prepare("SELECT id FROM orders WHERE remote_id = ?").get(ro.id);
      if (alreadyPulled) continue;

      const customerId = findOrCreateCustomer(ro.customer_name, ro.customer_phone);

      const result = insertOrder.run(
        ro.total,
        ro.tax,
        ro.discount,
        ro.discount_percent || 0,
        ro.tax_percent || 0,
        ro.received || 0,
        ro.change_amount || 0,
        ro.customer_name || "",
        ro.customer_phone || "",
        customerId,
        ro.created_at,
        ro.id,
        ro.order_number || `ORD-${ro.id}`
      );

      const orderId = result.lastInsertRowid;

      for (const item of ro.items || []) {
        // Prefer the cost the origin device actually snapshotted at sale time
        // (now sent by mobile too); only fall back to today's local product cost
        // for older synced orders that predate that fix (where it'll be 0).
        const cost = item.purchase_price || getPurchasePrice(item.sku);

        insertItem.run(
          orderId,
          item.product_name,
          item.sku,
          item.price,
          item.qty,
          item.discount_percent || 0,
          item.discount_fixed || 0,
          item.total,
          cost
        );
      }

      pulledCount++;
    }

    if (pulledCount > 0) {
      console.log(`✅ Pulled ${pulledCount} new order(s) from server`);
    }

    return pulledCount;

  } catch (err) {
    console.log("❌ Pull orders failed:", err.message);
    return 0;
  }
}

// ================= IPC =================

// 🔥 LOGIN RESET: called right after every successful login, unconditionally —
// wipes all local business data (products/orders/customers/etc.) every time,
// same account or not, so the app always starts clean and reloads everything
// fresh from the server on the next sync.
ipcMain.handle("check-account-switch", (e, data) => {
  const newUserId = String(data?.user_id ?? "");

  const wipeTables = ["products", "orders", "order_items", "customers", "credit_payments", "returns", "expenses"];

  const transaction = db.transaction(() => {
    for (const table of wipeTables) {
      db.prepare(`DELETE FROM ${table}`).run();
    }

    const placeholders = wipeTables.map(() => "?").join(",");
    db.prepare(`DELETE FROM sqlite_sequence WHERE name IN (${placeholders})`).run(...wipeTables);
  });

  transaction();
  console.log(`🧹 Login reset — wiped local data for user ${newUserId}`);

  db.prepare(`
    INSERT INTO app_meta (key, value) VALUES ('last_user_id', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(newUserId);

  return { success: true, wiped: true };
});

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
        (sku, name, price, purchase_price, stock, image, unit, discount_percent, discount_fixed, product_bar_code, category_id, category_name, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            p.purchase_price || 0,
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

    // 🔥 CREDIT GUARD: underpayment requires a customer phone to track it against
    if ((order.received || 0) < order.total && !(order.customer?.phone || "").trim()) {
      return { success: false, message: "Customer name and phone are required for partial/credit payment" };
    }

    const customerId = findOrCreateCustomer(order.customer?.name, order.customer?.phone);
    const orderNumber = generateOrderNumber();

    const insertOrder = db.prepare(`
      INSERT INTO orders
      (total, tax, discount, discount_percent, tax_percent, received, change_amount, customer_name, customer_phone, customer_id, status, created_at, store_id, user_id, order_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), ?, ?, ?)
    `);

    const insertItem = db.prepare(`
      INSERT INTO order_items
      (order_id, product_name, sku, price, qty, discount_percent, discount_fixed, total, purchase_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        customerId,
        order.store_id, // ✅
  order.user_id,  // ✅
        orderNumber
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
          total,
          getPurchasePrice(item.sku)
        );

        // 🔥 UPDATE STOCK
        updateStock.run(item.qty, item.qty, item.sku);
      }

    });
  
    transaction(order);

    return { success: true, order_number: orderNumber };
  });

// returns

  ipcMain.handle("create-return", (e, data) => {
    const orderItem = db.prepare("SELECT * FROM order_items WHERE id = ?").get(data.order_item_id);

    if (!orderItem) {
      return { success: false, message: "Order item not found" };
    }

    const alreadyReturned = db.prepare(
      "SELECT COALESCE(SUM(qty), 0) as qty FROM returns WHERE order_item_id = ?"
    ).get(orderItem.id).qty;

    const availableQty = orderItem.qty - alreadyReturned;
    const qty = Number(data.qty) || 0;

    if (qty <= 0 || qty > availableQty) {
      return { success: false, message: `Only ${availableQty} unit(s) available to return` };
    }

    const unitPrice = orderItem.qty ? orderItem.total / orderItem.qty : 0;
    const refundAmount = unitPrice * qty;

    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderItem.order_id);

    let appliedToCredit = 0;
    if (order && order.customer_id) {
      const balance = getCustomerBalance(order.customer_id);
      appliedToCredit = Math.max(0, Math.min(balance, refundAmount));
    }
    const cashRefund = refundAmount - appliedToCredit;

    const transaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO returns
        (order_id, order_item_id, sku, product_name, qty, refund_amount, applied_to_credit, cash_refund, reason, store_id, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderItem.order_id,
        orderItem.id,
        orderItem.sku,
        orderItem.product_name,
        qty,
        refundAmount,
        appliedToCredit,
        cashRefund,
        data.reason || "",
        data.store_id || null,
        data.user_id || null
      );

      if (orderItem.sku) {
        db.prepare("UPDATE products SET stock = stock + ? WHERE sku = ?").run(qty, orderItem.sku);
      }
    });

    transaction();

    return {
      success: true,
      refund_amount: refundAmount,
      applied_to_credit: appliedToCredit,
      cash_refund: cashRefund,
    };
  });

  ipcMain.handle("get-order-returns", (e, orderId) => {
    return db.prepare(`
      SELECT * FROM returns WHERE order_id = ? ORDER BY id DESC
    `).all(orderId);
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


  ipcMain.handle("sync-orders", async (e, data) => {
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
          local_id: order.id,
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

      // 🔥 PULL DOWN: bring in any order placed elsewhere (e.g. mobile) that this
      // device doesn't have yet. Runs every time, independent of the push above.
      const pulled = await pullDownOrders(data?.user_id);

      return { success: true, pulled_orders: pulled };

    } catch (err) {
      console.log("Sync error:", err.message);
      return { success: false };
    }
  });

  ipcMain.handle("sync-customers", async (e, data) => {
    try {
      const customers = db.prepare(`
        SELECT * FROM customers WHERE synced = 0
      `).all();

      const payments = db.prepare(`
        SELECT cp.*, c.phone as customer_phone, c.name as customer_name
        FROM credit_payments cp
        JOIN customers c ON c.id = cp.customer_id
        WHERE cp.synced = 0
      `).all();

      let result = { success: true, synced_customers: 0, synced_payments: 0 };

      if (customers.length > 0 || payments.length > 0) {
        const res = await fetch(
          `https://sialkotians.com/wp-json/pos/v1/sync-customers?nocache=${Date.now()}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              store_id: data?.store_id,
              user_id: data?.user_id,
              customers: customers.map((c) => ({
                phone: c.phone,
                name: c.name,
              })),
              payments: payments.map((p) => ({
                local_id: p.id,
                phone: p.customer_phone,
                name: p.customer_name,
                amount: p.amount,
                note: p.note,
                created_at: p.created_at,
              })),
            }),
          }
        );

        result = await res.json();

        if (result.success) {
          const markCustomerSynced = db.prepare("UPDATE customers SET synced = 1 WHERE id = ?");
          for (const c of customers) markCustomerSynced.run(c.id);

          const markPaymentSynced = db.prepare("UPDATE credit_payments SET synced = 1 WHERE id = ?");
          for (const p of payments) markPaymentSynced.run(p.id);

          console.log(`✅ Synced ${customers.length} customers, ${payments.length} payments`);
        }
      }

      // 🔥 PULL DOWN: bring in any credit payments recorded elsewhere (e.g. mobile)
      // that this device doesn't have yet. Runs every time, independent of the push above.
      const pulled = await pullDownCreditPayments(data?.user_id);
      result.pulled_payments = pulled;

      return result;

    } catch (err) {
      console.log("❌ Customer sync failed:", err.message);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("sync-returns", async (e, data) => {
    try {
      const returns = db.prepare(`
        SELECT * FROM returns WHERE synced = 0
      `).all();

      if (returns.length === 0) {
        return { success: true, synced_returns: 0 };
      }

      const res = await fetch(
        `https://sialkotians.com/wp-json/pos/v1/sync-returns?nocache=${Date.now()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            store_id: data?.store_id,
            user_id: data?.user_id,
            returns: returns.map((r) => ({
              local_id: r.id,
              local_order_id: r.order_id,
              sku: r.sku,
              product_name: r.product_name,
              qty: r.qty,
              refund_amount: r.refund_amount,
              applied_to_credit: r.applied_to_credit,
              cash_refund: r.cash_refund,
              reason: r.reason,
              created_at: r.created_at,
            })),
          }),
        }
      );

      const result = await res.json();

      if (result.success) {
        const markReturnSynced = db.prepare("UPDATE returns SET synced = 1 WHERE id = ?");
        for (const r of returns) markReturnSynced.run(r.id);

        console.log(`✅ Synced ${returns.length} returns`);
      }

      return result;

    } catch (err) {
      console.log("❌ Returns sync failed:", err.message);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("sync-expenses", async (e, data) => {
    try {
      const user_id = data?.user_id;
      const res = await fetch(
        `https://sialkotians.com/wp-json/pos/v1/expenses?user_id=${user_id}&nocache=${Date.now()}`,
        {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        }
      );
      const expenses = await res.json();

      const insert = db.prepare(`
        INSERT INTO expenses (remote_id, description, amount, created_at)
        VALUES (?, ?, ?, ?)
      `);

      const transaction = db.transaction((expenses) => {
        db.prepare("DELETE FROM expenses").run();

        for (const exp of expenses) {
          insert.run(exp.id, exp.description, exp.amount, exp.date);
        }
      });

      transaction(expenses);

      console.log(`✅ Synced ${expenses.length} expenses`);
      return { success: true, count: expenses.length };

    } catch (err) {
      console.log("❌ Expenses sync failed:", err.message);
      return { success: false, message: err.message };
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

    // 🔥 CREDIT GUARD: underpayment requires a customer phone to track it against
    if ((order.received || 0) < order.total && !(order.customer?.phone || "").trim()) {
      return { success: false, message: "Customer name and phone are required for partial/credit payment" };
    }

    const customerId = findOrCreateCustomer(order.customer?.name, order.customer?.phone);

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
            customer_id = ?,
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
        customerId,
        order.store_id,   // ✅
  order.user_id,    // ✅
        order.id
      );
  
      // ✅ 4. DELETE OLD ITEMS
      db.prepare("DELETE FROM order_items WHERE order_id = ?").run(order.id);
  
      // ✅ 5. PREPARE INSERT + STOCK UPDATE
      const insert = db.prepare(`
        INSERT INTO order_items
        (order_id, product_name, sku, price, qty, discount_percent, discount_fixed, total, purchase_price)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          totalItem,
          getPurchasePrice(item.sku)
        );

        // 🔥 deduct new stock
        updateStock.run(item.qty, item.qty, item.sku);
      }
  
    });
  
    transaction(order);

    return true;
  });

// customers & credit

  ipcMain.handle("search-customers", (e, query) => {
    const q = `%${(query || "").trim()}%`;

    const customers = db.prepare(`
      SELECT * FROM customers
      WHERE name LIKE ? OR phone LIKE ?
      ORDER BY name
    `).all(q, q);

    return customers.map((c) => ({
      ...c,
      balance: getCustomerBalance(c.id),
    }));
  });

  ipcMain.handle("get-customer-detail", (e, customerId) => {
    const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(customerId);
    if (!customer) return null;

    const orders = db.prepare(`
      SELECT id, total, received, (total - received) as due, status, created_at
      FROM orders
      WHERE customer_id = ?
      ORDER BY id DESC
    `).all(customerId);

    const payments = db.prepare(`
      SELECT * FROM credit_payments
      WHERE customer_id = ?
      ORDER BY id DESC
    `).all(customerId);

    return {
      ...customer,
      balance: getCustomerBalance(customerId),
      orders,
      payments,
    };
  });

  ipcMain.handle("add-credit-payment", (e, payment) => {
    const balance = getCustomerBalance(payment.customer_id);
    const amount = Number(payment.amount) || 0;

    if (amount <= 0) {
      return { success: false, message: "Payment amount must be greater than 0" };
    }

    if (amount > balance) {
      return { success: false, message: `Payment (${amount}) exceeds outstanding balance (${balance})` };
    }

    db.prepare(`
      INSERT INTO credit_payments (customer_id, amount, note, store_id, user_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(payment.customer_id, amount, payment.note || "", payment.store_id || null, payment.user_id || null);

    return { success: true, balance: balance - amount };
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

  const SALES_PERIODS = {
    today:      "DATE(created_at) = DATE('now')",
    yesterday:  "DATE(created_at) = DATE('now', '-1 day')",
    this_week:  "strftime('%Y-%W', created_at) = strftime('%Y-%W', 'now')",
    this_month: "strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')",
    last_month: "strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', '-1 month')",
    this_year:  "strftime('%Y', created_at) = strftime('%Y', 'now')",
  };

  function periodStats(condition) {
    const orders = db.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(total),0) as t FROM orders WHERE ${condition}`).get();
    const returned = db.prepare(`SELECT COALESCE(SUM(refund_amount),0) as t FROM returns WHERE ${condition}`).get();

    // 🔥 COST: qty * purchase_price snapshotted on each order item at sale time,
    // minus the cost of whatever was returned in this same period.
    const cost = db.prepare(`
      SELECT COALESCE(SUM(oi.qty * oi.purchase_price), 0) as c
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE ${condition}
    `).get().c;

    const returnedCost = db.prepare(`
      SELECT COALESCE(SUM(r.qty * oi.purchase_price), 0) as c
      FROM returns r
      JOIN order_items oi ON oi.id = r.order_item_id
      WHERE ${condition}
    `).get().c;

    const net = orders.t - returned.t;
    const netCost = cost - returnedCost;

    // 🔥 CASH vs CREDIT: how much was actually paid at sale time vs left as a balance,
    // for orders PLACED in this period. Cash is capped at the order's own total — any
    // amount received above that is change handed back, not money actually kept.
    const cashSales = db.prepare(`SELECT COALESCE(SUM(MIN(received, total)), 0) as t FROM orders WHERE ${condition}`).get().t;
    const creditGiven = db.prepare(`SELECT COALESCE(SUM(MAX(total - received, 0)), 0) as t FROM orders WHERE ${condition}`).get().t;

    // 🔥 CREDIT COLLECTED: payments against ANY past credit balance, counted on the day
    // the payment itself was made (credit_payments.created_at) — not the original sale's date.
    // This is what lets "customer ordered yesterday, paid today" show up in today's collection.
    const creditCollected = db.prepare(`SELECT COALESCE(SUM(amount), 0) as t FROM credit_payments WHERE ${condition}`).get().t;

    // 🔥 TOTAL COLLECTION: actual cash in hand for this period — today's cash sales
    // plus whatever was collected today against older credit.
    const totalCollection = cashSales + creditCollected;

    return {
      orders: orders.c, gross: orders.t, returns: returned.t, net, cost: netCost, profit: net - netCost,
      cashSales, creditGiven, creditCollected, totalCollection,
    };
  }

  ipcMain.handle("get-sales-report", () => {
    const report = {};
    for (const key in SALES_PERIODS) {
      report[key] = periodStats(SALES_PERIODS[key]);
    }
    return report;
  });

  const PROFIT_LOSS_PERIODS = {
    today:      "DATE(created_at) = DATE('now')",
    yesterday:  "DATE(created_at) = DATE('now', '-1 day')",
    this_month: "strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')",
    last_month: "strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', '-1 month')",
    this_year:  "strftime('%Y', created_at) = strftime('%Y', 'now')",
    last_year:  "strftime('%Y', created_at) = strftime('%Y', 'now', '-1 year')",
  };

  function profitLossStats(condition) {
    const sales = periodStats(condition);

    const expenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as t FROM expenses WHERE ${condition}
    `).get().t;

    return {
      netSales: sales.net,
      cogs: sales.cost,
      grossProfit: sales.profit,
      expenses,
      netProfit: sales.profit - expenses,
    };
  }

  ipcMain.handle("get-profit-loss", () => {
    const report = {};
    for (const key in PROFIT_LOSS_PERIODS) {
      report[key] = profitLossStats(PROFIT_LOSS_PERIODS[key]);
    }
    return report;
  });

  const updateStock = db.prepare(`
    UPDATE products 
SET stock = CASE 
  WHEN stock >= ? THEN stock - ?
  ELSE 0
END
WHERE sku = ?
  `);