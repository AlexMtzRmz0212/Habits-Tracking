"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The lock screen.
 *
 * This component never receives private data as props -- when the session is
 * invalid the server renders only this, and does not query the database at
 * all. So there is nothing here to reveal by inspecting the page source.
 */
export default function PinGate() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (response.ok) {
        // A refresh re-runs the server component, which will now see a valid
        // cookie and fetch the data for the first time.
        router.refresh();
        return;
      }

      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Could not unlock.");
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
      setPin("");
    }
  }

  return (
    <main className="shell">
      <form className="gate" onSubmit={submit}>
        <p className="meta">Private</p>
        <h1 style={{ fontSize: "1.4rem", margin: "0.5rem 0 1.5rem" }}>
          This dashboard is locked
        </h1>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          autoFocus
          autoComplete="current-password"
          aria-label="PIN"
        />
        <div className="error">{error}</div>
        <button type="submit" disabled={busy || pin.length === 0}>
          {busy ? "Checking…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}
