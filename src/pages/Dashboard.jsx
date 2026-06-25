import { useEffect, useState } from "react";

export default function Dashboard({ goToPOS, goToPOSVisual, goToOrders, onLogout }) {
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
    await window.electron?.invoke("sync-orders"); 
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

  return (
    <div style={styles.container}>
      
      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <p style={{ color: "#666" }}>Welcome, {user?.name}</p>
        </div>

        <button onClick={handleLogout} style={styles.logoutBtn}>
          Logout
        </button>
      </div>

      {/* ACTION CARDS */}
      <div style={styles.actions}>
        <div style={styles.actionCard} onClick={() => goToPOS()}>
          <h2>🛒 Start Sales</h2>
          <p>Create a new order</p>
        </div>

        <div style={styles.actionCard} onClick={() => goToPOSVisual()}>
          <h2>🛒 Start Sales Visual</h2>
          <p>Create a new order</p>
        </div>

        <div style={styles.actionCard} onClick={() => goToOrders()}>
          <h2>📦 View Orders</h2>
          <p>Manage previous orders</p>
        </div>
      </div>

      {/* STATS */}
      <h2 style={{ marginTop: 30 }}>📊 Sales Overview</h2>

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
    onClick={handleSyncProducts}
    style={styles.syncBtn}
    disabled={syncingProducts}
  >
    {syncingProducts ? "Syncing..." : "🔄 Sync Products"}
  </button>

  <button
    onClick={handleSyncOrders}
    style={styles.syncBtnSecondary}
    disabled={syncingOrders}
  >
    {syncingOrders ? "Syncing..." : "📤 Sync Orders"}
  </button>


  <button
    onClick={handleSyncStock}
    style={styles.syncBtnSecondary}
    disabled={syncingStock}
  >
    {syncingStock ? "Syncing..." : "📤 Sync Stock"}
  </button>

  
</div>
    </div>
  );
}

/* STAT CARD COMPONENT */
function StatCard({ title, count, amount, units }) {
  return (
    <div style={styles.statCard}>
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
    padding: 20,
    background: "#f5f6fa",
    minHeight: "100vh",
    fontFamily: "Arial, sans-serif"
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },

  logoutBtn: {
    background: "#ff4d4f",
    color: "#fff",
    border: "none",
    padding: "10px 15px",
    borderRadius: 6,
    cursor: "pointer"
  },

  actions: {
    display: "flex",
    gap: 20,
    marginTop: 20
  },

  actionCard: {
    flex: 1,
    background: "#fff",
    padding: 20,
    borderRadius: 12,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    transition: "0.2s",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 15,
    marginTop: 15
  },

  statCard: {
    background: "#fff",
    padding: 15,
    borderRadius: 12,
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
  },

  statTitle: {
    margin: 0,
    color: "#888",
    fontSize: 14
  },

  amount: {
    margin: 0,
    color: "green",
    fontWeight: "bold",
    fontSize: 16
  },

  units: {
    margin: 0,
    color: "#555",
    fontSize: 14
  },

  syncBar: {
    position: "fixed",
    bottom: 0,
    left: 0,
    width: "100%",
    background: "#fff",
    padding: 12,
    display: "flex",
    justifyContent: "center",
    gap: 15,
    boxShadow: "0 -2px 10px rgba(0,0,0,0.08)"
  },
  
  syncBtn: {
    padding: "10px 20px",
    background: "#1890ff",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: "bold"
  },
  
  syncBtnSecondary: {
    padding: "10px 20px",
    background: "#52c41a",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: "bold"
  }
};