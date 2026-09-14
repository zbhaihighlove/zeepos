import { useEffect, useState } from "react";
import { colors } from "../theme";

const PERIODS = [
  { key: "today", title: "Today" },
  { key: "yesterday", title: "Yesterday" },
  { key: "this_month", title: "This Month" },
  { key: "last_month", title: "Last Month" },
  { key: "this_year", title: "This Year" },
  { key: "last_year", title: "Last Year" },
];

export default function ProfitLoss({ goBack }) {
  const [report, setReport] = useState(null);

  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport() {
    const data = await window.electron?.invoke("get-profit-loss");
    setReport(data);
  }

  function formatCurrency(value) {
    return Number(value || 0).toFixed(2);
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button className="pos-btn" onClick={goBack} style={styles.backBtn}>
          ← Back
        </button>
        <h2 style={{ margin: 0, color: colors.black }}>📉 Profit & Loss</h2>
        <span />
      </div>

      {!report ? (
        <p>Loading...</p>
      ) : (
        <div style={styles.grid}>
          {PERIODS.map(({ key, title }) => {
            const stats = report[key] || {
              netSales: 0,
              cogs: 0,
              grossProfit: 0,
              expenses: 0,
              netProfit: 0,
            };

            return (
              <div key={key} className="pos-card" style={styles.card}>
                <p style={styles.title}>{title}</p>

                <div style={styles.row}>
                  <span style={styles.label}>Net Sales</span>
                  <span style={styles.value}>💰 {formatCurrency(stats.netSales)}</span>
                </div>

                <div style={styles.row}>
                  <span style={styles.label}>Cost of Goods</span>
                  <span style={styles.cost}>🧾 {formatCurrency(stats.cogs)}</span>
                </div>

                <div style={styles.row}>
                  <span style={styles.label}>Gross Profit</span>
                  <span style={styles.value}>📦 {formatCurrency(stats.grossProfit)}</span>
                </div>

                <div style={styles.row}>
                  <span style={styles.label}>Expenses</span>
                  <span style={styles.cost}>🏷 {formatCurrency(stats.expenses)}</span>
                </div>

                <div style={styles.divider} />

                <div style={styles.row}>
                  <span style={styles.label}>Net Profit</span>
                  <span style={stats.netProfit >= 0 ? styles.profit : styles.loss}>
                    {stats.netProfit >= 0 ? "📈" : "📉"} {formatCurrency(stats.netProfit)}
                  </span>
                </div>
              </div>
            );
          })}
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
    margin: "0 0 8px",
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
  value: {
    fontWeight: "bold",
    color: colors.black,
  },
  cost: {
    color: colors.warning,
    fontWeight: "bold",
  },
  divider: {
    borderTop: `1px dashed ${colors.border}`,
    margin: "8px 0",
  },
  profit: {
    color: colors.primaryDark,
    fontWeight: "bold",
    fontSize: 16,
  },
  loss: {
    color: colors.danger,
    fontWeight: "bold",
    fontSize: 16,
  },
};
