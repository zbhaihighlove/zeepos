import { useState } from "react";
import { colors } from "../theme";

// Re-checks the SAME login password (via the same /login endpoint) before
// revealing sensitive pages like Sales Report / Profit & Loss. Unlocked state
// lives only in this component's memory — leaving the page and coming back
// always re-prompts, matching the "should pop up again" requirement.
export default function PasswordGate({ onCancel, children }) {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function handleUnlock(e) {
    e.preventDefault();
    if (!password) return;

    setChecking(true);
    setError("");

    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const username = user.username || user.email;

      const res = await fetch("https://sialkotians.com/wp-json/pos/v1/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setUnlocked(true);
      } else {
        setError(data.message || "Incorrect password");
      }
    } catch (err) {
      setError("Could not verify password. Check your connection.");
    } finally {
      setChecking(false);
    }
  }

  if (unlocked) return children;

  return (
    <div style={styles.overlay}>
      <form onSubmit={handleUnlock} style={styles.card}>
        <div style={styles.icon}>🔒</div>
        <h3 style={styles.title}>Password Required</h3>
        <p style={styles.subtitle}>Enter your login password to view this page.</p>

        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={styles.input}
        />

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.actions}>
          <button type="button" onClick={onCancel} style={styles.cancelBtn}>
            Cancel
          </button>
          <button type="submit" disabled={checking} style={styles.unlockBtn}>
            {checking ? "Checking..." : "Unlock"}
          </button>
        </div>
      </form>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  card: {
    width: 320,
    padding: "28px 26px",
    background: colors.surface,
    borderRadius: 14,
    boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
    textAlign: "center",
  },
  icon: { fontSize: 32, marginBottom: 8 },
  title: { margin: "0 0 6px", color: colors.black },
  subtitle: { margin: "0 0 16px", color: colors.muted, fontSize: 13 },
  input: {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    fontSize: 14,
    boxSizing: "border-box",
    background: colors.background,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: 10, marginBottom: 0 },
  actions: { display: "flex", gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    background: "transparent",
    color: colors.text,
    cursor: "pointer",
    fontWeight: 600,
  },
  unlockBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    border: "none",
    background: colors.primary,
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
};
