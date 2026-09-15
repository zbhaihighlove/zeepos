import { useEffect, useState } from "react";
import { colors } from "../theme";
import PasswordGate from "../components/PasswordGate";

const PERIODS = [
  { key: "today", title: "Today" },
  { key: "yesterday", title: "Yesterday" },
  { key: "this_week", title: "This Week" },
  { key: "this_month", title: "This Month" },
  { key: "last_month", title: "Last Month" },
  { key: "this_year", title: "This Year" },
];

export default function SalesReport({ goBack }) {
  const [report, setReport] = useState(null);

  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport() {
    const data = await window.electron?.invoke("get-sales-report");
    setReport(data);
  }

  function formatCurrency(value) {
    return Number(value || 0).toFixed(2);
  }

  return (
    <PasswordGate onCancel={goBack}>
    <div style={styles.container}>
      <div style={styles.header}>
        <button className="pos-btn" onClick={goBack} style={styles.backBtn}>
          ← Back
        </button>
        <h2 style={{ margin: 0, color: colors.black }}>📊 Sales Report</h2>
        <span />
      </div>

      {!report ? (
        <p>Loading...</p>
      ) : (
        <div style={styles.grid}>
          {PERIODS.map(({ key, title }) => {
            const stats = report[key] || {
              orders: 0, gross: 0, returns: 0, net: 0, cost: 0, profit: 0,
              cashSales: 0, creditGiven: 0, creditCollected: 0, totalCollection: 0,
            };

            return (
              <div key={key} className="pos-card" style={styles.card}>
                <p style={styles.title}>{title}</p>
                <h3 style={{ margin: "5px 0", color: colors.black }}>Orders: {stats.orders}</h3>

                <div style={styles.row}>
                  <span style={styles.label}>Total Sales</span>
                  <span style={styles.gross}>💰 {formatCurrency(stats.gross)}</span>
                </div>

                <div style={styles.row}>
                  <span style={styles.label}>Returns</span>
                  <span style={styles.returns}>↩ {formatCurrency(stats.returns)}</span>
                </div>

                <div style={styles.row}>
                  <span style={styles.label}>Net Sales</span>
                  <span style={styles.net}>✅ {formatCurrency(stats.net)}</span>
                </div>

                <div style={styles.divider} />

                <div style={styles.row}>
                  <span style={styles.label}>Cash (paid at sale)</span>
                  <span style={styles.gross}>💵 {formatCurrency(stats.cashSales)}</span>
                </div>

                <div style={styles.row}>
                  <span style={styles.label}>Credit Given</span>
                  <span style={styles.returns}>🧾 {formatCurrency(stats.creditGiven)}</span>
                </div>

                <div style={styles.row}>
                  <span style={styles.label}>Credit Collected</span>
                  <span style={styles.net}>🤝 {formatCurrency(stats.creditCollected)}</span>
                </div>

                <div style={styles.row}>
                  <span style={styles.collectionLabel}>Total Collection</span>
                  <span style={styles.collection}>🏦 {formatCurrency(stats.totalCollection)}</span>
                </div>

                <div style={styles.divider} />

                <div style={styles.row}>
                  <span style={styles.label}>Cost</span>
                  <span style={styles.cost}>🧾 {formatCurrency(stats.cost)}</span>
                </div>

                <div style={styles.row}>
                  <span style={styles.label}>Profit</span>
                  <span style={styles.profit}>📈 {formatCurrency(stats.profit)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </PasswordGate>
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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 15,
  },
  card: {
    background: colors.surface,
    padding: 18,
    borderRadius: 14,
    boxShadow: colors.cardShadow,
    borderTop: `3px solid ${colors.primary}`,
  },
  title: {
    margin: 0,
    color: colors.muted,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 6,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
  },
  gross: {
    fontWeight: "bold",
    color: colors.black,
  },
  returns: {
    color: colors.danger,
    fontWeight: "bold",
  },
  net: {
    color: colors.primary,
    fontWeight: "bold",
  },
  divider: {
    borderTop: `1px dashed ${colors.border}`,
    margin: "8px 0",
  },
  cost: {
    color: colors.warning,
    fontWeight: "bold",
  },
  profit: {
    color: colors.primaryDark,
    fontWeight: "bold",
    fontSize: 15,
  },
  collectionLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: 600,
  },
  collection: {
    color: colors.primaryDark,
    fontWeight: "bold",
    fontSize: 16,
  },
};
