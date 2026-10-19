"use client";

import { useCallback, useState } from "react";
import { GithubLogo, GoogleLogo } from "@phosphor-icons/react";
import { signInWithOAuth } from "@/lib/auth";

/**
 * How long a provider press holds its in-flight mark. The browser hop measured
 * 1.50-2.41 s per cold request from the owner's network; past twice that, the
 * browser has either left (nothing reads this) or never did, which is the case
 * that has to hand the control back.
 */
const OAUTH_HANDOFF_GRACE_MS = 5000;

type Provider = "google" | "github";

/**
 * The two provider buttons, with the press lifecycle that goes with them.
 *
 * This file deliberately imports no auth state. A press here must not wait on
 * the mount-time session probe — starting a provider flow works with or without
 * a session — and the strongest way to hold that is to keep the probe out of
 * scope rather than to gate on it correctly. /login and /signup each had their
 * own copy of the pair until Sonar scored the repetition 3.7% duplicated new
 * code; one implementation is also one place for tests/unit/oauth-door-clickable
 * to guard, and it reports the outcome through `onResult` so the two doors can
 * keep their own error surfaces.
 */
export function OAuthProviderButtons({ onResult }: { onResult: (message: string | null) => void }) {
  const [pending, setPending] = useState<Provider | null>(null);

  const press = useCallback(
    async (provider: Provider) => {
      // Before the await: `signInWithOAuth` resolves once the browser has been
      // told to leave, so a press that writes no state looks exactly like the
      // disabled button it replaced — which is how one press becomes three.
      setPending(provider);
      onResult(null);
      try {
        await signInWithOAuth(provider);
        window.setTimeout(() => {
          setPending(null);
          onResult(`${provider} sign-in did not start. Please try again.`);
        }, OAUTH_HANDOFF_GRACE_MS);
      } catch (error) {
        setPending(null);
        console.error(`${provider} sign-in failed`, error);
        onResult(`${provider} sign-in failed. Please try again.`);
      }
    },
    [onResult]
  );

  const button = "flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-900 bg-slate-900 hover:bg-slate-800 text-sm font-bold text-white shadow-[0_4px_12px_rgba(15,23,42,0.15)] transition-all disabled:opacity-50 disabled:cursor-not-allowed";
  const spinner = "w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin";

  return (
    <div className="grid grid-cols-2 gap-4">
      <button
        onClick={() => void press("google")}
        type="button"
        disabled={pending !== null}
        aria-busy={pending === "google"}
        className={button}
      >
        {pending === "google" ? <span aria-hidden="true" className={spinner} /> : <GoogleLogo weight="bold" className="w-4 h-4" />} Google
      </button>
      <button
        onClick={() => void press("github")}
        type="button"
        disabled={pending !== null}
        aria-busy={pending === "github"}
        className={button}
      >
        {pending === "github" ? <span aria-hidden="true" className={spinner} /> : <GithubLogo weight="fill" className="w-4 h-4" />} GitHub
      </button>
    </div>
  );
}
