import { useEffect, useState } from "react";
import { colors } from "../theme";

export default function Customers({ goBack }) {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  // ✅ Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  const storeId = localStorage.getItem("store_id");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    search();
  }, []);

  async function search() {
    try {
      const data = await window.electron?.invoke("search-customers", query);
      setCustomers(Array.isArray(data) ? data : []);
      setCurrentPage(1);
    } catch (err) {
      console.error(err);
    }
  }

  async function openCustomer(customer) {
    setSelected(customer);
    await loadDetail(customer.id);
  }

  async function loadDetail(customerId) {
    const data = await window.electron.invoke("get-customer-detail", customerId);
    setDetail(data);
  }

  async function recordPayment() {
    const amount = Number(paymentAmount);

    if (!amount || amount <= 0) {
      return alert("Enter a valid payment amount");
    }

    const result = await window.electron.invoke("add-credit-payment", {
      customer_id: selected.id,
      amount,
      note: paymentNote,
      store_id: storeId,
      user_id: user.id,
    });

    if (result && result.success === false) {
      return alert(result.message || "Failed to record payment");
    }

    setPaymentAmount("");
    setPaymentNote("");
    await loadDetail(selected.id);
    await search();
  }

  function formatCurrency(value) {
    return Number(value || 0).toFixed(2);
  }

  function formatDate(date) {
    return date ? new Date(date).toLocaleString() : "-";
  }

  // ✅ DETAIL VIEW
  if (selected) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button
            className="pos-btn"
            onClick={() => {
              setSelected(null);
              setDetail(null);
            }}
            style={styles.backBtn}
          >
            ← Back
          </button>
          <h2 style={{ margin: 0 }}>👤 {selected.name || "Customer"}</h2>
          <span />
        </div>

        {!detail ? (
          <p>Loading...</p>
        ) : (
          <>
            <div style={styles.summaryCard}>
              <div>
                <span style={styles.label}>Phone</span>
                <div>{detail.phone}</div>
              </div>
              <div>
                <span style={styles.label}>Outstanding Balance</span>
                <div style={{
                  ...styles.balance,
                  color: detail.balance > 0 ? colors.danger : colors.primary
                }}>
                  {formatCurrency(detail.balance)}
                </div>
              </div>
            </div>

            {/* RECORD PAYMENT */}
            {detail.balance > 0 && (
              <div style={styles.paymentCard}>
                <h3 style={{ marginTop: 0 }}>💵 Record Payment</h3>
                <div style={styles.paymentRow}>
                  <input
                    type="number"
                    placeholder="Amount"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    style={styles.input}
                  />
                  <input
                    type="text"
                    placeholder="Note (optional)"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    style={styles.input}
                  />
                  <button className="pos-btn" onClick={recordPayment} style={styles.newBtn}>
                    Add Payment
                  </button>
                </div>
              </div>
            )}

            {/* ORDERS */}
            <h3>🧾 Orders</h3>
            <div style={styles.grid}>
              {detail.orders.length === 0 && <p>No orders yet</p>}
              {detail.orders.map((order) => (
                <div key={order.id} className="pos-card" style={styles.card}>
                  <div style={styles.rowBetween}>
                    <strong>Order #{order.id}</strong>
                    <span>{formatDate(order.created_at)}</span>
                  </div>
                  <div style={styles.info}>
                    <div>
                      <span style={styles.label}>Total</span>
                      <div>{formatCurrency(order.total)}</div>
                    </div>
                    <div>
                      <span style={styles.label}>Received</span>
                      <div>{formatCurrency(order.received)}</div>
                    </div>
                    <div>
                      <span style={styles.label}>Due</span>
                      <div style={{ color: order.due > 0 ? colors.danger : colors.primary }}>
                        {formatCurrency(order.due)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* PAYMENT HISTORY */}
            <h3>📜 Payment History</h3>
            <div style={styles.grid}>
              {detail.payments.length === 0 && <p>No payments recorded yet</p>}
              {detail.payments.map((p) => (
                <div key={p.id} className="pos-card" style={styles.card}>
                  <div style={styles.rowBetween}>
                    <strong style={{ color: colors.primary }}>
                      + {formatCurrency(p.amount)}
                    </strong>
                    <span>{formatDate(p.created_at)}</span>
                  </div>
                  {p.note && <div style={styles.label}>{p.note}</div>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // ✅ Pagination Logic
  const totalPages = Math.ceil(customers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentCustomers = customers.slice(startIndex, startIndex + itemsPerPage);

  // ✅ SEARCH / LIST VIEW
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button className="pos-btn" onClick={goBack} style={styles.backBtn}>
          ← Back
        </button>
        <h2 style={{ margin: 0 }}>👥 Customers & Credits</h2>
        <span />
      </div>

      <div style={styles.searchRow}>
        <input
          type="text"
          placeholder="Search by name or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          style={styles.input}
        />
        <button className="pos-btn" onClick={search} style={styles.newBtn}>
          Search
        </button>
      </div>

      {customers.length === 0 && (
        <div style={styles.empty}>
          <p>No customers found</p>
        </div>
      )}

      <div style={styles.list}>
        {currentCustomers.map((c) => (
          <div key={c.id} className="pos-card" style={styles.listRow} onClick={() => openCustomer(c)}>
            <div>
              <strong>{c.name || "Unnamed"}</strong>
              <span style={styles.phoneInline}>{c.phone}</span>
            </div>
            <span
              style={{
                ...styles.balance,
                fontSize: 16,
                color: c.balance > 0 ? colors.danger : colors.primary,
              }}
            >
              {formatCurrency(c.balance)}
            </span>
          </div>
        ))}
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
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
                background: currentPage === i + 1 ? colors.primary : "#fff",
                color: currentPage === i + 1 ? "#fff" : colors.black,
              }}
            >
              {i + 1}
            </button>
          ))}

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
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
    padding: 24,
    background: colors.background,
    minHeight: "100vh",
    fontFamily: "inherit",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  backBtn: {
    padding: "8px 14px",
    background: colors.black,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },
  newBtn: {
    padding: "10px 16px",
    background: colors.primary,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },
  empty: {
    textAlign: "center",
    marginTop: 50,
    color: colors.muted,
  },
  searchRow: {
    display: "flex",
    gap: 10,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 6,
    border: `1px solid ${colors.border}`,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 15,
    marginBottom: 20,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 20,
  },
  listRow: {
    background: colors.surface,
    padding: "14px 18px",
    borderRadius: 10,
    boxShadow: colors.cardShadow,
    borderLeft: `3px solid ${colors.primary}`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
  },
  phoneInline: {
    marginLeft: 12,
    fontSize: 13,
    color: colors.muted,
  },
  pagination: {
    marginTop: 10,
    display: "flex",
    justifyContent: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  pageBtn: {
    padding: "6px 12px",
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    cursor: "pointer",
    background: "#fff",
  },
  card: {
    background: colors.surface,
    padding: 15,
    borderRadius: 14,
    boxShadow: colors.cardShadow,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    cursor: "pointer",
  },
  rowBetween: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  info: {
    display: "flex",
    justifyContent: "space-between",
  },
  label: {
    display: "block",
    fontSize: 12,
    color: colors.muted,
  },
  balance: {
    fontWeight: "bold",
  },
  summaryCard: {
    background: colors.surface,
    padding: 20,
    borderRadius: 14,
    boxShadow: colors.cardShadow,
    borderLeft: `4px solid ${colors.primary}`,
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  paymentCard: {
    background: colors.surface,
    padding: 15,
    borderRadius: 14,
    boxShadow: colors.cardShadow,
    marginBottom: 20,
  },
  paymentRow: {
    display: "flex",
    gap: 10,
  },
};
