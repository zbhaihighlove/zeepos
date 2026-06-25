import { useState } from "react";

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
      <div style={styles.card}>
        <h1 style={styles.title}>POS System</h1>
        <p style={styles.subtitle}>Login to continue</p>

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
    background: "linear-gradient(135deg, #1e3c72, #2a5298)"
  },
  card: {
    width: 320,
    padding: 30,
    borderRadius: 12,
    background: "#ffffff",
    boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
    textAlign: "center"
  },
  title: {
    marginBottom: 5,
    fontSize: 28,
    fontWeight: "bold",
    color: "#333"
  },
  subtitle: {
    marginBottom: 20,
    fontSize: 14,
    color: "#777"
  },
  input: {
    width: "100%",
    padding: 12,
    marginBottom: 15,
    borderRadius: 8,
    border: "1px solid #ddd",
    fontSize: 14,
    outline: "none",
    transition: "0.2s",
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    padding: 12,
    background: "#2a5298",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    cursor: "pointer",
    transition: "0.2s",
  },
  error: {
    color: "red",
    fontSize: 13,
    marginBottom: 10
  }
};