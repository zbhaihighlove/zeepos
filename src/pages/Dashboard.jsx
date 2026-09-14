import { useEffect, useState } from "react";
import { colors } from "../theme";

export default function Dashboard({ goToPOS, goToPOSVisual, goToOrders, goToCustomers, goToSalesReport, goToProfitLoss, onLogout }) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const [stats, setStats] = useState({
    today: 0,
    todayAmount: 0,
    todayUnits: 0,

    month: 0,
    monthAmount: 0,
    monthUnits: 0,

    year: 0,
    yearAmount: 0,
    yearUnits: 0
  });

  useEffect(() => {
    async function loadStats() {
      const data = await window.electron?.invoke("get-order-stats");
      if (data) setStats(data);
    }
    loadStats();
  }, []);

  function handleLogout() {
    localStorage.clear();
    if (onLogout) onLogout();
  }

  const [syncingProducts, setSyncingProducts] = useState(false);
const [syncingOrders, setSyncingOrders] = useState(false);
const [syncingStock, setSyncingStock] = useState(false);

async function handleSyncProducts() {
  setSyncingProducts(true);
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");

await window.electron.invoke("sync-products", {
  user_id: user.id
});
    alert("✅ Products synced");
  } catch (err) {
    alert("❌ Failed to sync products");
  }
  setSyncingProducts(false);
}

async function handleSyncOrders() {
  setSyncingOrders(true);
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    await window.electron?.invoke("sync-orders", { user_id: user.id });
    alert("✅ Orders synced");
  } catch (err) {
    alert("❌ Failed to sync orders");
  }
  setSyncingOrders(false);
}

async function handleSyncStock() {
  setSyncingStock(true);
  try {

    const user = JSON.parse(
      localStorage.getItem("user") || "{}"
    );

    const result = await window.electron.invoke(
      "sync-stock",
      {
        user_id: user.id
      }
    );

    alert(
      `✅ ${result.synced_orders} orders synced`
    );

  } catch (err) {
    alert("❌ Stock sync failed");
  }
  setSyncingStock(false);
}

const [syncingCustomers, setSyncingCustomers] = useState(false);

async function handleSyncCustomers() {
  setSyncingCustomers(true);
  try {
    const storeId = localStorage.getItem("store_id");
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    const result = await window.electron.invoke("sync-customers", {
      store_id: storeId,
      user_id: user.id
    });

    if (result && result.success === false) {
      alert(result.message || "❌ Failed to sync customers");
    } else {
      alert("✅ Customers & credits synced");
    }
  } catch (err) {
    alert("❌ Failed to sync customers");
  }
  setSyncingCustomers(false);
}

const [syncingReturns, setSyncingReturns] = useState(false);

async function handleSyncReturns() {
  setSyncingReturns(true);
  try {
    const storeId = localStorage.getItem("store_id");
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    const result = await window.electron.invoke("sync-returns", {
      store_id: storeId,
      user_id: user.id
    });

    if (result && result.success === false) {
      alert(result.message || "❌ Failed to sync returns");
    } else {
      alert("✅ Returns synced");
    }
  } catch (err) {
    alert("❌ Failed to sync returns");
  }
  setSyncingReturns(false);
}

const [syncingExpenses, setSyncingExpenses] = useState(false);

async function handleSyncExpenses() {
  setSyncingExpenses(true);
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    const result = await window.electron.invoke("sync-expenses", {
      user_id: user.id
    });

    if (result && result.success === false) {
      alert(result.message || "❌ Failed to sync expenses");
    } else {
      alert(`✅ ${result.count} expenses synced`);
    }
  } catch (err) {
    alert("❌ Failed to sync expenses");
  }
  setSyncingExpenses(false);
}

const [syncingAll, setSyncingAll] = useState(false);

async function handleSyncAll() {
  setSyncingAll(true);

  const storeId = localStorage.getItem("store_id");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const steps = [
    { label: "Products",  setter: setSyncingProducts,  channel: "sync-products",  args: { user_id: user.id } },
    { label: "Orders",    setter: setSyncingOrders,    channel: "sync-orders",    args: { user_id: user.id } },
    { label: "Stock",     setter: setSyncingStock,     channel: "sync-stock",     args: { user_id: user.id } },
    { label: "Customers", setter: setSyncingCustomers, channel: "sync-customers", args: { store_id: storeId, user_id: user.id } },
    { label: "Returns",   setter: setSyncingReturns,   channel: "sync-returns",   args: { store_id: storeId, user_id: user.id } },
    { label: "Expenses",  setter: setSyncingExpenses,  channel: "sync-expenses",  args: { user_id: user.id } },
  ];

  const failures = [];

  for (const step of steps) {
    step.setter(true);
    try {
      const result = await window.electron.invoke(step.channel, step.args);
      if (result && result.success === false) {
        failures.push(`${step.label}: ${result.message || "failed"}`);
      }
    } catch (err) {
      failures.push(`${step.label}: failed`);
    }
    step.setter(false);
  }

  if (failures.length === 0) {
    alert("✅ Everything synced successfully");
  } else {
    alert(`⚠️ Synced with issues:\n${failures.join("\n")}`);
  }

  setSyncingAll(false);
}

  return (
    <div style={styles.container}>
      
      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Zee POS</p>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <p style={{ color: colors.muted, margin: "4px 0 0" }}>Welcome, {user?.name}</p>
        </div>

        <button className="pos-btn" onClick={handleLogout} style={styles.logoutBtn}>
          Logout
        </button>
      </div>

      {/* ACTION CARDS */}
      <div style={styles.actions}>
        <div className="pos-card" style={styles.actionCard} onClick={() => goToPOS()}>
          <span style={styles.actionIcon}>🛒</span>
          <h2 style={styles.actionTitle}>Start Sales</h2>
          <p style={styles.actionText}>Create a new order</p>
        </div>

        <div className="pos-card" style={styles.actionCard} onClick={() => goToPOSVisual()}>
          <span style={styles.actionIcon}>🛒</span>
          <h2 style={styles.actionTitle}>Start Sales Visual</h2>
          <p style={styles.actionText}>Create a new order</p>
        </div>

        <div className="pos-card" style={styles.actionCard} onClick={() => goToOrders()}>
          <span style={styles.actionIcon}>📦</span>
          <h2 style={styles.actionTitle}>View Orders</h2>
          <p style={styles.actionText}>Manage previous orders</p>
        </div>

        <div className="pos-card" style={styles.actionCard} onClick={() => goToCustomers()}>
          <span style={styles.actionIcon}>👥</span>
          <h2 style={styles.actionTitle}>Customers & Credits</h2>
          <p style={styles.actionText}>Track balances & payments</p>
        </div>

        <div className="pos-card" style={styles.actionCard} onClick={() => goToSalesReport()}>
          <span style={styles.actionIcon}>📊</span>
          <h2 style={styles.actionTitle}>Sales Report</h2>
          <p style={styles.actionText}>Gross & net sales by period</p>
        </div>

        <div className="pos-card" style={styles.actionCard} onClick={() => goToProfitLoss()}>
          <span style={styles.actionIcon}>📉</span>
          <h2 style={styles.actionTitle}>Profit & Loss</h2>
          <p style={styles.actionText}>Item cost & expenses by period</p>
        </div>
      </div>

      {/* STATS */}
      <h2 style={styles.sectionTitle}>📊 Sales Overview</h2>

      <div style={styles.grid}>
        <StatCard
          title="Today"
          count={stats.today}
          amount={stats.todayAmount}
          units={stats.todayUnits}
        />

        <StatCard
          title="This Month"
          count={stats.month}
          amount={stats.monthAmount}
          units={stats.monthUnits}
        />

        <StatCard
          title="This Year"
          count={stats.year}
          amount={stats.yearAmount}
          units={stats.yearUnits}
        />
      </div>


      {/* 🔥 SYNC BAR */}
<div style={styles.syncBar}>
  <button
    className="pos-btn"
    onClick={handleSyncAll}
    style={styles.syncAllBtn}
    disabled={syncingAll}
  >
    {syncingAll ? "Syncing Everything..." : "⚡ Sync Everything"}
  </button>

  <button
    className="pos-btn"
    onClick={handleSyncProducts}
    style={styles.syncBtn}
    disabled={syncingProducts || syncingAll}
  >
    {syncingProducts ? "Syncing..." : "🔄 Sync Products"}
  </button>

  <button
    className="pos-btn"
    onClick={handleSyncOrders}
    style={styles.syncBtnSecondary}
    disabled={syncingOrders || syncingAll}
  >
    {syncingOrders ? "Syncing..." : "📤 Sync Orders"}
  </button>


  <button
    className="pos-btn"
    onClick={handleSyncStock}
    style={styles.syncBtnSecondary}
    disabled={syncingStock || syncingAll}
  >
    {syncingStock ? "Syncing..." : "📤 Sync Stock"}
  </button>

  <button
    className="pos-btn"
    onClick={handleSyncCustomers}
    style={styles.syncBtnSecondary}
    disabled={syncingCustomers || syncingAll}
  >
    {syncingCustomers ? "Syncing..." : "📤 Sync Customers"}
  </button>

  <button
    className="pos-btn"
    onClick={handleSyncReturns}
    style={styles.syncBtnSecondary}
    disabled={syncingReturns || syncingAll}
  >
    {syncingReturns ? "Syncing..." : "📤 Sync Returns"}
  </button>

  <button
    className="pos-btn"
    onClick={handleSyncExpenses}
    style={styles.syncBtnSecondary}
    disabled={syncingExpenses || syncingAll}
  >
    {syncingExpenses ? "Syncing..." : "📤 Sync Expenses"}
  </button>


</div>
    </div>
  );
}

/* STAT CARD COMPONENT */
function StatCard({ title, count, amount, units }) {
  return (
    <div className="pos-card" style={styles.statCard}>
      <p style={styles.statTitle}>{title}</p>

      <h3 style={{ margin: "5px 0" }}>Orders: {count}</h3>

      <p style={styles.amount}>💰 {amount.toFixed(2)}</p>

      <p style={styles.units}>📦 {units} items</p>
    </div>
  );
}

/* STYLES */
const styles = {
  container: {
    padding: "24px 24px 90px",
    background: colors.background,
    minHeight: "100vh",
    fontFamily: "inherit"
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },

  eyebrow: {
    margin: 0,
    color: colors.primary,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase"
  },

  logoutBtn: {
    background: colors.black,
    color: "#fff",
    border: "none",
    padding: "10px 18px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600
  },

  actions: {
    display: "flex",
    gap: 18,
    marginTop: 24,
    flexWrap: "wrap"
  },

  actionCard: {
    flex: "1 1 200px",
    background: colors.surface,
    padding: 22,
    borderRadius: 14,
    cursor: "pointer",
    boxShadow: colors.cardShadow,
    borderTop: `3px solid ${colors.primary}`,
  },

  actionIcon: {
    display: "inline-flex",
    width: 40,
    height: 40,
    borderRadius: 10,
    background: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    marginBottom: 10,
  },

  actionTitle: {
    margin: "0 0 4px",
    fontSize: 16,
    color: colors.black,
  },

  actionText: {
    margin: 0,
    fontSize: 13,
    color: colors.muted,
  },

  sectionTitle: {
    marginTop: 34,
    color: colors.black,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 15,
    marginTop: 15
  },

  statCard: {
    background: colors.surface,
    padding: 18,
    borderRadius: 14,
    boxShadow: colors.cardShadow
  },

  statTitle: {
    margin: 0,
    color: colors.muted,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  amount: {
    margin: 0,
    color: colors.primary,
    fontWeight: "bold",
    fontSize: 18
  },

  units: {
    margin: 0,
    color: colors.muted,
    fontSize: 13
  },

  syncBar: {
    position: "fixed",
    bottom: 0,
    left: 0,
    width: "100%",
    background: colors.black,
    padding: 14,
    display: "flex",
    justifyContent: "center",
    gap: 12,
    flexWrap: "wrap",
    boxShadow: "0 -4px 16px rgba(0,0,0,0.25)"
  },

  syncAllBtn: {
    padding: "10px 22px",
    background: `linear-gradient(135deg, ${colors.primaryLight}, ${colors.primaryDark})`,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: "bold"
  },

  syncBtn: {
    padding: "10px 20px",
    background: colors.primary,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: "bold"
  },

  syncBtnSecondary: {
    padding: "10px 20px",
    background: colors.charcoal,
    color: "#fff",
    border: `1px solid ${colors.slate}`,
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: "bold"
  }
};