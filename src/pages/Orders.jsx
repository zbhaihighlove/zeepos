import { useEffect, useState } from "react";

export default function Orders({ goBack, goToPOS, goToPOSVisual }) {
  const [orders, setOrders] = useState([]);

  // ✅ Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const storeId = localStorage.getItem("store_id");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      const data = await window.electron?.invoke("get-orders");
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }

  async function editOrder(order) {
    const fullOrder = await window.electron.invoke(
      "get-order-by-id",
      order.id
    );
    goToPOS(fullOrder);
  }
  

  async function editOrderVisual(order) {
    const fullOrder = await window.electron.invoke(
      "get-order-by-id",
      order.id
    );
    goToPOSVisual(fullOrder);
  }


  async function printOrder(order) {
    const fullOrder = await window.electron.invoke(
      "get-order-by-id",
      order.id
    );
  
    const html = generateBillHTML(fullOrder, user);
  
    await window.electron.invoke("print-bill", html);
  }

  function generateBillHTML(order, user) {
    return `
    <html>
      <head>
        <style>
  @page {
    size: 72mm auto;
    margin: 0;
  }

  html, body {
    margin: 0;
    padding: 0;
    width: 72mm;
    font-family: monospace;
    font-size: 12px;
  }

  body {
    padding: 4px;
    box-sizing: border-box;
  }

  .center {
    text-align: center;
  }

  .logo {
    width: 60px;
    margin: 0 auto;
    display: block;
  }

  .line {
    border-top: 1px dashed #000;
    margin: 6px 0;
  }

  .row {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    width: 100%;
  }

  .bold {
    font-weight: bold;
  }

  .total {
    font-size: 20px;
    font-weight: bold;
  }

  .small {
    font-size: 11px;
  }
</style>
      </head>
  
      <body>
  
        <!-- LOGO -->
        <div class="center">
          <img src="${user?.avatar}" class="logo" />
          <h3>${user?.name}</h3>
          <div class="small">${new Date(order.created_at).toLocaleString()}</div>
        </div>
  
        <div class="line"></div>
  
        <!-- ITEMS -->
        ${order.items.map(i => {
          const base = i.price * i.qty;
          const percent = (base * (i.itemDiscountPercent || 0)) / 100;
          const total = base - (percent + (i.itemDiscountFixed || 0));
  
          return `
            <div class="row bold">
              <span>${i.name}</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <div class="row small">
              <span>${i.qty} x ${i.price}</span>
              <span>${i.itemDiscountPercent || 0}% + ${i.itemDiscountFixed || 0}</span>
            </div>
          `;
        }).join("")}
  
        <div class="line"></div>
  
        <!-- SUMMARY -->
        <div class="row">
          <span>Subtotal</span>
          <span>${order.items.reduce((sum, i) => {
            const base = i.price * i.qty;
            const percent = (base * (i.itemDiscountPercent || 0)) / 100;
            return sum + (base - (percent + (i.itemDiscountFixed || 0)));
          }, 0).toFixed(2)}</span>
        </div>
  
        <div class="row">
          <span>Discount</span>
          <span>${order.discount.toFixed(2)}</span>
        </div>
  
        <div class="row">
          <span>Tax</span>
          <span>${order.tax.toFixed(2)}</span>
        </div>
  
        <div class="line"></div>
  
        <div class="row total">
          <span>NET TOTAL</span>
          <span>${order.total.toFixed(2)}</span>
        </div>
  
        <div class="line"></div>
  
        <!-- PAYMENT -->
        <div class="row">
          <span>Received</span>
          <span>${order.received?.toFixed(2) || 0}</span>
        </div>
  
        <div class="row">
          <span>Change</span>
          <span>${order.change?.toFixed(2) || 0}</span>
        </div>
  
        <div class="line"></div>
  
        <!-- FOOTER -->
        <div class="center small">
          <p>📞 ${user?.phone_1}</p>
          <p>${user?.tag_line}</p>
          <p>Visit again 😊</p>
        </div>
  
      </body>
    </html>
    `;
  }

  function formatDate(date) {
    return date ? new Date(date).toLocaleString() : "-";
  }

  function formatCurrency(value) {
    return Number(value || 0).toFixed(2);
  }

  function getStatusColor(status) {
    if (status === "pending") return "#faad14";
    if (status === "synced") return "#52c41a";
    return "#999";
  }

  // ✅ Pagination Logic
  const totalPages = Math.ceil(orders.length / itemsPerPage);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentOrders = orders.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  return (
    <div style={styles.container}>

      {/* HEADER */}
      <div style={styles.header}>
        <button onClick={goBack} style={styles.backBtn}>
          ← Back
        </button>

        <h2 style={{ margin: 0 }}>📦 Orders</h2>

        <button onClick={() => goToPOS()} style={styles.newBtn}>
          + New Order
        </button>
      </div>

      {/* EMPTY */}
      {orders.length === 0 && (
        <div style={styles.empty}>
          <p>No orders found</p>
        </div>
      )}

      {/* GRID */}
      <div style={styles.grid}>
        {currentOrders.map(order => (
          <div key={order.id} style={styles.card}>

            {/* TOP */}
            <div style={styles.rowBetween}>
              <h3 style={{ margin: 0 }}>Order #{order.id}</h3>

              <span
                style={{
                  ...styles.status,
                  background: getStatusColor(order.status)
                }}
              >
                {order.status}
              </span>
            </div>

            {/* INFO */}
            <div style={styles.info}>
              <div>
                <span style={styles.label}>Date</span>
                <span>{formatDate(order.created_at)}</span>
              </div>

              <div>
                <span style={styles.label}>Total</span>
                <span style={styles.amount}>
                  💰 {formatCurrency(order.total)}
                </span>
              </div>
            </div>

            {/* CUSTOMER */}
            <div style={styles.customer}>
              <span>{order.customer_name || "Walk-in Customer"}</span>
              <span style={styles.phone}>
                {order.customer_phone}
              </span>
            </div>

            {/* ACTION */}
            <div style={styles.actions}>
  <button
    style={styles.editBtn}
    onClick={() => editOrder(order)}
  >
    ✏️ POS
  </button>

  <button
    style={styles.editVisualBtn}
    onClick={() => editOrderVisual(order)}
  >
    🖼 Visual
  </button>

  <button
    style={styles.printBtn}
    onClick={() => printOrder(order)}
  >
    🖨 Print
  </button>
</div>

          </div>
        ))}
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div style={styles.pagination}>

          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            style={styles.pageBtn}
          >
            ← Prev
          </button>

          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i + 1)}
              style={{
                ...styles.pageBtn,
                background:
                  currentPage === i + 1 ? "#1890ff" : "#fff",
                color:
                  currentPage === i + 1 ? "#fff" : "#000"
              }}
            >
              {i + 1}
            </button>
          ))}

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            style={styles.pageBtn}
          >
            Next →
          </button>

        </div>
      )}
    </div>
  );
}

/* STYLES */
const styles = {
  container: {
    padding: 20,
    background: "#f5f6fa",
    minHeight: "100vh",
    fontFamily: "Arial, sans-serif"
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20
  },

  backBtn: {
    padding: "8px 12px",
    border: "none",
    borderRadius: 6,
    cursor: "pointer"
  },

  newBtn: {
    padding: "10px 15px",
    background: "#1890ff",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer"
  },

  empty: {
    textAlign: "center",
    marginTop: 50,
    color: "#888"
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 15
  },

  card: {
    background: "#fff",
    padding: 15,
    borderRadius: 12,
    boxShadow: "0 4px 10px rgba(0,0,0,0.06)",
    display: "flex",
    flexDirection: "column",
    gap: 10
  },

  rowBetween: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },

  status: {
    color: "#fff",
    padding: "4px 10px",
    borderRadius: 20,
    fontSize: 12
  },

  info: {
    display: "flex",
    justifyContent: "space-between"
  },

  label: {
    display: "block",
    fontSize: 12,
    color: "#888"
  },

  amount: {
    fontWeight: "bold",
    color: "green"
  },

  customer: {
    borderTop: "1px solid #eee",
    paddingTop: 8,
    display: "flex",
    flexDirection: "column"
  },

  phone: {
    fontSize: 12,
    color: "#888"
  },

  actions: {
    display: "flex",
    justifyContent: "flex-end"
  },

  editBtn: {
    background: "#faad14",
    border: "none",
    padding: "8px 12px",
    borderRadius: 6,
    cursor: "pointer",
    color: "#fff"
  },

  pagination: {
    marginTop: 20,
    display: "flex",
    justifyContent: "center",
    gap: 8,
    flexWrap: "wrap"
  },

  pageBtn: {
    padding: "6px 12px",
    border: "1px solid #ddd",
    borderRadius: 6,
    cursor: "pointer",
    background: "#fff"
  },
  editVisualBtn: {
    background: "#1890ff",
    border: "none",
    padding: "8px 12px",
    borderRadius: 6,
    cursor: "pointer",
    color: "#fff",
    marginLeft: 6
  },
  printBtn: {
    background: "#2ecc71",
    border: "none",
    padding: "8px 12px",
    borderRadius: 6,
    cursor: "pointer",
    color: "#fff",
    marginLeft: 6
  }
};