"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A send that never reached the route used to look exactly like a slow answer:
 * no alert, the composer already cleared, and only the candidate's own line in
 * the transcript. On a phone that is the ordinary shape of a dropped
 * connection, so the recovery owns three things:
 *
 *   - the text, captured before the request leaves;
 *   - the statement that it did not arrive (the caller renders the banner);
 *   - the retry, which re-asks the route for the turn already in the transcript.
 *
 * It lives in a hook rather than the room page because that file is at its
 * longest-source-file ceiling; the behaviour is the same either way.
 */
export function useSendFailureRecovery({
  error,
  setInputText,
  regenerate,
}: {
  error: Error | undefined;
  setInputText: (value: string) => void;
  regenerate: () => Promise<void>;
}) {
  const lastSentTextRef = useRef("");
  const [dismissed, setDismissed] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Restoring the answer is what makes the retry their answer rather than a
  // blank turn. Keyed on the error object so it runs once per failure.
  useEffect(() => {
    if (!error) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(false);
    if (lastSentTextRef.current) setInputText(lastSentTextRef.current);
  }, [error, setInputText]);

  const remember = useCallback((text: string) => {
    lastSentTextRef.current = text;
  }, []);

  const retry = useCallback(async () => {
    setRetrying(true);
    try {
      await regenerate();
    } finally {
      setRetrying(false);
    }
  }, [regenerate]);

  return {
    visible: Boolean(error) && !dismissed,
    retrying,
    retry,
    dismiss: () => setDismissed(true),
    remember,
  };
}
