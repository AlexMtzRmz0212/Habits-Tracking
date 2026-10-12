"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The lock screen: a closed, clasped diary on the desk with a card slipped out
 * of its pocket asking for the PIN.
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
    <main id="main" className="desk">
      <div className="locked-diary">
        <div className="cover-face locked-cover">
          <div className="cover-stitch" aria-hidden="true" />
          <div className="cover-plate">
            <p className="cover-title">Private</p>
            <p className="cover-sub">The owner&apos;s pages</p>
          </div>
          <svg className="padlock" viewBox="0 0 64 80" width="56" height="70" aria-hidden="true">
            <path d="M18 34V22a14 14 0 0 1 28 0v12" fill="none" strokeWidth="6" className="brass-line" />
            <rect x="8" y="32" width="48" height="40" rx="8" className="brass" />
            <circle cx="32" cy="50" r="5" className="brass-dark" />
            <rect x="30" y="52" width="4" height="10" rx="2" className="brass-dark" />
          </svg>
        </div>

        <form className="pin-card" onSubmit={submit}>
          <h1 className="pin-title">This diary is locked</h1>
          <label className="pin-label" htmlFor="pin">
            PIN
          </label>
          <input
            id="pin"
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoFocus
            autoComplete="current-password"
            aria-label="PIN"
          />
          <div className="error" role="alert">
            {error}
          </div>
          <button type="submit" className="pen-button" disabled={busy || pin.length === 0}>
            {busy ? "Checking…" : "Unlock"}
          </button>
          <Link href="/" className="pin-back">
            Back to the public diary
          </Link>
        </form>
      </div>
    </main>
  );
}
