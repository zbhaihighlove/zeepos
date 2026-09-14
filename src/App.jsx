import { useEffect, useState } from "react";
import Login from "./pages/Login";
import POS from "./pages/POS";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Customers from "./pages/Customers";
import SalesReport from "./pages/SalesReport";
import ProfitLoss from "./pages/ProfitLoss";

import POSVisual from "./pages/POSVisual";
function App() {
  const [screen, setScreen] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [editingOrder, setEditingOrder] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      setScreen("dashboard");
    } else {
      setScreen("login");
    }
  }, []);

  // ✅ CENTRAL NAVIGATION
  function navigate(to, data = null) {
    if (to === "pos" || to === "posvisual") {
      setEditingOrder(data);
      setReloadKey(Date.now());
      setScreen(to);
    } else {
      setEditingOrder(null);
      setScreen(to);
    }
  }

  // 🔐 LOGIN
  if (screen === "login") {
    return (
      <Login
        onLoginSuccess={async () => {
          // await window.electron.invoke("sync-products");
          setReloadKey(Date.now());
          setScreen("dashboard");
        }}
      />
    );
  }

  // 🏠 DASHBOARD
  if (screen === "dashboard") {
    return (
      <Dashboard
        goToPOS={() => navigate("pos")}
        goToPOSVisual={() => navigate("posvisual")}
        
        goToOrders={() => navigate("orders")}
        goToCustomers={() => navigate("customers")}
        goToSalesReport={() => navigate("salesreport")}
        goToProfitLoss={() => navigate("profitloss")}
        onLogout={() => setScreen("login")}
      />
    );
  }

  // 🧾 POS
  if (screen === "pos") {
    return (
      <POS
        key={reloadKey}
        goBack={() => navigate("dashboard")}
        editingOrder={editingOrder} // 👈 IMPORTANT
      />
    );
  }

  if (screen === "posvisual") {
    return (
      <POSVisual   // ✅ CORRECT
        key={reloadKey}
        goBack={() => navigate("dashboard")}
        editingOrder={editingOrder}
      />
    );
  }

  // 📦 ORDERS
  if (screen === "orders") {
    return (
      <Orders
  goBack={() => navigate("dashboard")}
  goToPOS={(order) => navigate("pos", order)}
  goToPOSVisual={(order) => navigate("posvisual", order)} // ✅ ADD
/>
    );
  }

  // 👥 CUSTOMERS & CREDITS
  if (screen === "customers") {
    return <Customers goBack={() => navigate("dashboard")} />;
  }

  // 📊 SALES REPORT
  if (screen === "salesreport") {
    return <SalesReport goBack={() => navigate("dashboard")} />;
  }

  // 📉 PROFIT & LOSS
  if (screen === "profitloss") {
    return <ProfitLoss goBack={() => navigate("dashboard")} />;
  }

  return <div>Loading...</div>;
}

export default App;