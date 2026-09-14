import { useState } from "react";
import { colors } from "../theme";

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    if (!username || !password) {
      setError("Enter username & password");
      return;
    }
  
    setLoading(true);
    setError("");
  
    try {
      const res = await fetch("https://sialkotians.com/wp-json/pos/v1/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });
  
      const data = await res.json();
  
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Login failed");
      }
  
      // 🔥 ACCOUNT SWITCH CHECK: if this is a different account than whoever was
      // last logged in on this machine, wipe local orders/products/customers/etc.
      // before storing the new session — the next sync repopulates from the server.
      if (window.electron) {
        await window.electron.invoke("check-account-switch", { user_id: data.user.id });
      }

      localStorage.setItem("token", data.token);
localStorage.setItem("user", JSON.stringify(data.user)); // ✅ ADD
localStorage.setItem("store_id", data.store_id);         // ✅ ADD

      // 🔥 IMPORTANT: WAIT FOR SYNC
      if (window.electron) {
        // const result = await window.electron.invoke("sync-products");

        // console.log("SYNC RESULT:", result);

        // if (!result.success) {
        //   throw new Error("Sync failed");
        // }
      }

      localStorage.setItem("last_sync", Date.now());
  
      // ✅ ONLY after successful sync
      onLoginSuccess();
  
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.glow} />
      <div style={styles.card}>
        <div style={styles.badge}>Z</div>
        <h1 style={styles.title}>Zee POS</h1>
        <p style={styles.subtitle}>Sign in to your store</p>

        <input
          style={styles.input}
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          style={styles.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p style={styles.error}>{error}</p>}

        <button
          className="pos-btn"
          style={styles.button}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: colors.gradient,
    position: "relative",
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    width: 500,
    height: 500,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(18,153,106,0.35), transparent 70%)",
    top: "-150px",
    right: "-150px",
    pointerEvents: "none",
  },
  card: {
    width: 340,
    padding: "36px 32px",
    borderRadius: 16,
    background: colors.surface,
    boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
    textAlign: "center",
    position: "relative",
    zIndex: 1,
  },
  badge: {
    width: 48,
    height: 48,
    margin: "0 auto 14px",
    borderRadius: 12,
    background: colors.gradient,
    color: "#fff",
    fontWeight: "bold",
    fontSize: 22,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    marginBottom: 4,
    fontSize: 24,
    fontWeight: 700,
    color: colors.black,
  },
  subtitle: {
    marginBottom: 24,
    fontSize: 13,
    color: colors.muted,
  },
  input: {
    width: "100%",
    padding: 12,
    marginBottom: 14,
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    fontSize: 14,
    outline: "none",
    transition: "0.2s",
    boxSizing: "border-box",
    background: colors.background,
  },
  button: {
    width: "100%",
    padding: 13,
    background: colors.primary,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 6,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: 10,
  },
};