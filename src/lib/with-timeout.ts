/**
 * Settles a promise that might never settle.
 *
 * Needed wherever a pending promise gates something a user must be able to do.
 * The case that prompted it: the auth bootstrap awaits `supabase.auth.getUser()`
 * with no deadline, and its completion is what enables the Sign In / Sign Up
 * buttons on /login and /signup. A stalled token refresh therefore does not
 * degrade to "signed-in state unknown" — it locks the front door, because the
 * page whose whole job is to get you signed in is waiting on the answer.
 *
 * The raced value is deliberately supplied by the caller: only the caller knows
 * which answer means "proceed as unverified" for its own call site.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  onTimeout: () => T
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(onTimeout()), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
