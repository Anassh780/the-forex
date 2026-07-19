"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  function reloadApplication() {
    window.location.reload();
  }

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#020707",
          color: "#F4F8F5",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
            Critical Error
          </h1>
          <p style={{ color: "#8D9B96", fontSize: "0.875rem", maxWidth: "28rem" }}>
            EdgeLedger encountered a fatal error. Please try refreshing the page.
          </p>
          <button
            onClick={reloadApplication}
            style={{
              marginTop: "1.5rem",
              padding: "0.625rem 1.25rem",
              backgroundColor: "#9BF56A",
              color: "#020707",
              border: "none",
              borderRadius: "0.5rem",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Reload application
          </button>
        </div>
      </body>
    </html>
  );
}
