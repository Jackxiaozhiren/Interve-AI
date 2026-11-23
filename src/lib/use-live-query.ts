/**
 * Kept out of api-client.ts: that module is imported by Server Components
 * (S5 server reads), and a React hook there drags useEffect into the RSC
 * graph. No client directive is needed — the two importers are already
 * client components, so the boundary is inherited from them and the ratchet
 * does not gain a file.
 */
import { useState, useEffect } from 'react';

export function useLiveQuery<T>(querier: () => Promise<T> | T | undefined, deps: React.DependencyList = []): T | undefined {
  const [data, setData] = useState<T | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const result = await querier();
        if (isMounted) setData(result as T);
      } catch (err) {
        console.error('useLiveQuery error:', err);
      }
    };
    fetchData();
    return () => { isMounted = false; };
    // `deps` is caller-controlled by design (variable dep list): callers pass
    // inline closures, so a static list cannot be verified. Tracked debt, see
    // MASTER_AUDIT P2-3. Do not remove without refactoring all call sites.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return data;
}
