import { useEffect, useState } from "react";
import { colors } from "../theme";

export default function Orders({ goBack, goToPOS, goToPOSVisual }) {
  const [orders, setOrders] = useState([]);

  // ✅ Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const storeId = localStorage.getItem("store_id");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // ✅ Returns
  const [returningOrder, setReturningOrder] = useState(null);
  const [returnQty, setReturnQty] = useState({});
  const [returnReason, setReturnReason] = useState("");

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

  async function openReturn(order) {
    const fullOrder = await window.electron.invoke("get-order-by-id", order.id);
    const returns = await window.electron.invoke("get-order-returns", order.id);
    setReturningOrder({ ...fullOrder, returns });
    setReturnQty({});
    setReturnReason("");
  }

  function alreadyReturnedQty(itemId) {
    return returningOrder.returns
      .filter((r) => r.order_item_id === itemId)
      .reduce((sum, r) => sum + r.qty, 0);
  }

  async function submitReturn(item) {
    const qty = Number(returnQty[item.id] || 0);

    if (!qty || qty <= 0) {
      return alert("Enter a quantity to return");
    }

    const result = await window.electron.invoke("create-return", {
      order_item_id: item.id,
      qty,
      reason: returnReason,
      store_id: storeId,
      user_id: user.id,
    });

    if (result && result.success === false) {
      return alert(result.message || "Return failed");
    }

    alert(
      `Return recorded.\nApplied to credit: ${formatCurrency(result.applied_to_credit)}\nCash refund: ${formatCurrency(result.cash_refund)}`
    );

    const returns = await window.electron.invoke("get-order-returns", returningOrder.id);
    setReturningOrder((prev) => ({ ...prev, returns }));
    setReturnQty((prev) => ({ ...prev, [item.id]: "" }));
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

        ${(order.customer_name || order.customer_phone) ? `
        <!-- CUSTOMER -->
        <div class="row small">
          <span>Customer</span>
          <span>${order.customer_name || "-"}</span>
        </div>
        ${order.customer_phone ? `
        <div class="row small">
          <span>Phone</span>
          <span>${order.customer_phone}</span>
        </div>
        ` : ""}

        <div class="line"></div>
        ` : ""}

        <!-- ITEMS -->
        ${order.items.map(i => {
          const base = i.price * i.qty;
          const percent = (base * (i.discount_percent || 0)) / 100;
          const total = base - (percent + (i.discount_fixed || 0));

          return `
            <div class="row bold">
              <span>${i.product_name}</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <div class="row small">
              <span>${i.qty} x ${i.price}</span>
              <span>${i.discount_percent || 0}% + ${i.discount_fixed || 0}</span>
            </div>
          `;
        }).join("")}

        <div class="line"></div>

        <!-- SUMMARY -->
        <div class="row">
          <span>Subtotal</span>
          <span>${order.items.reduce((sum, i) => {
            const base = i.price * i.qty;
            const percent = (base * (i.discount_percent || 0)) / 100;
            return sum + (base - (percent + (i.discount_fixed || 0)));
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
          <span>${order.change_amount?.toFixed(2) || 0}</span>
        </div>

        ${order.received < order.total ? `
        <div class="row" style="color:#c0392b;font-weight:bold;">
          <span>Balance Due</span>
          <span>${(order.total - order.received).toFixed(2)}</span>
        </div>
        ` : ""}

        <div class="line"></div>

        <!-- FOOTER -->
        <div class="center small">
          <p>📞 ${user?.phone_1}</p>
          <p>${user?.tag_line}</p>
          <p>Visit again 😊</p>
        </div>

        <div class="center" style="font-size:6px;color:#555;margin-top:4px;">
          Developed by MZEE Technologies - 03460364457
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
        <button className="pos-btn" onClick={goBack} style={styles.backBtn}>
          ← Back
        </button>

        <h2 style={{ margin: 0, color: colors.black }}>📦 Orders</h2>

        <button className="pos-btn" onClick={() => goToPOS()} style={styles.newBtn}>
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
          <div key={order.id} className="pos-card" style={styles.card}>

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

            {/* PAID / CREDIT */}
            <div style={styles.info}>
              <div>
                <span style={styles.label}>Paid</span>
                <span>💵 {formatCurrency(order.received)}</span>
              </div>

              <div>
                <span style={styles.label}>Credit</span>
                <span style={{ color: (order.total - order.received) > 0 ? colors.danger : colors.primary, fontWeight: "bold" }}>
                  {(order.total - order.received) > 0 ? `🧾 ${formatCurrency(order.total - order.received)}` : "✅ Paid in full"}
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
    className="pos-btn"
    style={styles.editBtn}
    onClick={() => editOrder(order)}
  >
    ✏️ POS
  </button>

  <button
    className="pos-btn"
    style={styles.editVisualBtn}
    onClick={() => editOrderVisual(order)}
  >
    🖼 Visual
  </button>

  <button
    className="pos-btn"
    style={styles.printBtn}
    onClick={() => printOrder(order)}
  >
    🖨 Print
  </button>

  <button
    className="pos-btn"
    style={styles.returnBtn}
    onClick={() => openReturn(order)}
  >
    ↩ Return
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
                  currentPage === i + 1 ? colors.primary : "#fff",
                color:
                  currentPage === i + 1 ? "#fff" : colors.black
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

      {/* RETURN MODAL */}
      {returningOrder && (
        <div style={styles.modalOverlay} onClick={() => setReturningOrder(null)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.rowBetween}>
              <h3 style={{ margin: 0 }}>↩ Return — Order #{returningOrder.id}</h3>
              <button style={styles.backBtn} onClick={() => setReturningOrder(null)}>✕</button>
            </div>

            <input
              type="text"
              placeholder="Reason (optional)"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              style={styles.reasonInput}
            />

            <div style={styles.returnItemList}>
              {returningOrder.items.map((item) => {
                const returned = alreadyReturnedQty(item.id);
                const available = item.qty - returned;

                return (
                  <div key={item.id} style={styles.returnItemRow}>
                    <div>
                      <strong>{item.product_name}</strong>
                      <div style={styles.label}>
                        Bought {item.qty} · Returned {returned} · Available {available}
                      </div>
                    </div>

                    {available > 0 ? (
                      <div style={styles.returnItemActions}>
                        <input
                          type="number"
                          min="1"
                          max={available}
                          placeholder="Qty"
                          value={returnQty[item.id] || ""}
                          onChange={(e) =>
                            setReturnQty((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          style={styles.qtyInput}
                        />
                        <button style={styles.returnBtn} onClick={() => submitReturn(item)}>
                          Return
                        </button>
                      </div>
                    ) : (
                      <span style={styles.label}>Fully returned</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* STYLES */
const styles = {
  container: {
    padding: 24,
    background: colors.background,
    minHeight: "100vh",
    fontFamily: "inherit"
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24
  },

  backBtn: {
    padding: "8px 14px",
    background: colors.black,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600
  },

  newBtn: {
    padding: "10px 16px",
    background: colors.primary,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600
  },

  empty: {
    textAlign: "center",
    marginTop: 50,
    color: colors.muted
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 15
  },

  card: {
    background: colors.surface,
    padding: 16,
    borderRadius: 14,
    boxShadow: colors.cardShadow,
    borderLeft: `3px solid ${colors.primary}`,
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
    color: colors.muted
  },

  amount: {
    fontWeight: "bold",
    color: colors.primary
  },

  customer: {
    borderTop: `1px solid ${colors.border}`,
    paddingTop: 8,
    display: "flex",
    flexDirection: "column"
  },

  phone: {
    fontSize: 12,
    color: colors.muted
  },

  actions: {
    display: "flex",
    justifyContent: "flex-end",
    flexWrap: "wrap"
  },

  editBtn: {
    background: colors.warning,
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
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    cursor: "pointer",
    background: "#fff"
  },
  editVisualBtn: {
    background: colors.charcoal,
    border: "none",
    padding: "8px 12px",
    borderRadius: 6,
    cursor: "pointer",
    color: "#fff",
    marginLeft: 6
  },
  printBtn: {
    background: colors.primary,
    border: "none",
    padding: "8px 12px",
    borderRadius: 6,
    cursor: "pointer",
    color: "#fff",
    marginLeft: 6
  },
  returnBtn: {
    background: colors.danger,
    border: "none",
    padding: "8px 12px",
    borderRadius: 6,
    cursor: "pointer",
    color: "#fff",
    marginLeft: 6
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(11,15,14,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100
  },
  modalBox: {
    background: colors.surface,
    borderRadius: 14,
    padding: 20,
    width: "90%",
    maxWidth: 480,
    maxHeight: "80vh",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 12
  },
  reasonInput: {
    padding: "10px 12px",
    borderRadius: 6,
    border: `1px solid ${colors.border}`
  },
  returnItemList: {
    display: "flex",
    flexDirection: "column",
    gap: 10
  },
  returnItemRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: `1px solid ${colors.border}`,
    paddingBottom: 10
  },
  returnItemActions: {
    display: "flex",
    gap: 6,
    alignItems: "center"
  },
  qtyInput: {
    width: 60,
    padding: "6px 8px",
    borderRadius: 6,
    border: `1px solid ${colors.border}`
  }
};