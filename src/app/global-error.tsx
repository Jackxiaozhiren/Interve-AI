"use client";

import { useEffect } from "react";

// This file replaces the root layout, and Next renders it without globals.css
// (16.3.5 docs; its own builtin/global-error.js ships an inline <style> for the
// same reason). Hence: own document, own stylesheet, no Tailwind classes.
// Nothing from `@/` is imported — the module graph that just failed owns those.
//
// Recovery actions mirror Next's builtin fallback, for one reason: this page is
// shown when the app's own JS did not survive, so the reload must not depend on
// an event handler. A native <form> submit reloads even with a dead bundle.

const LOCAL_CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    background: #FBFBFA;
    color: #0F172A;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
      "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    line-height: 1.6;
    text-align: center;
  }
  main { max-width: 52ch; }
  h1 { margin: 0 0 8px; font-size: 28px; font-weight: 650; letter-spacing: -0.01em; }
  p { margin: 0 auto 10px; color: #475569; font-size: 16px; }
  .badge {
    width: 56px; height: 56px; margin: 0 auto 20px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid #FECDD3; border-radius: 999px;
    background: #FFF1F2; color: #BE123C;
    font-size: 26px; font-weight: 700; line-height: 1;
  }
  .digest {
    margin: 14px auto 0; font-size: 13px; color: #475569;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .digest span { color: #0F172A; }
  .actions {
    margin-top: 26px;
    display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;
  }
  .actions form { margin: 0; }
  .button {
    appearance: none; cursor: pointer;
    border-radius: 999px; padding: 10px 20px;
    font-size: 15px; font-weight: 600; font-family: inherit;
  }
  .primary { border: 1px solid #0F172A; background: #0F172A; color: #FFFFFF; }
  .primary:hover { background: #1E293B; }
  .secondary { border: 1px solid #CBD5E1; background: #FFFFFF; color: #0F172A; }
  .secondary:hover { border-color: #94A3B8; }
  button:focus-visible {
    outline: 2px solid #1D4ED8; outline-offset: 2px;
  }
`;

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error("Unrecoverable error in the root layout:", error);
  }, [error]);

  // A digest means the throw happened on the server, so the stack is in the
  // logs and "Back" cannot help — reload is the only useful action there.
  const digest = error?.digest;

  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Something went wrong · Interve AI</title>
        <style>{LOCAL_CSS}</style>
      </head>
      <body>
        <main>
          <div className="badge" aria-hidden="true">
            !
          </div>
          <h1>Something went wrong</h1>
          <p>The app couldn&apos;t start. Reloading usually clears it.</p>
          {digest ? (
            <p className="digest">
              Reference: <span>{digest}</span>
            </p>
          ) : null}
          <div className="actions">
            <form>
              <button type="submit" className="button primary">
                Reload
              </button>
            </form>
            {!digest && (
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  if (window.history.length > 1) window.history.back();
                  else window.location.reload();
                }}
              >
                Go back
              </button>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}
