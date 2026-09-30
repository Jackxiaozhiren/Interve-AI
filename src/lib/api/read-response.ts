/**
 * One reader for every JSON API response the browser makes.
 *
 * The call sites this replaces each invented their own handling and all of them
 * lost the same thing: what the server actually said. Some had no `res.ok`
 * check at all, so an error response threw inside `.json()` and landed in a
 * generic catch; one told the user to "check your connection" when the server
 * had answered with a rate limit; others failed so quietly that a button
 * appeared to do nothing. Those failure modes are pinned individually in
 * tests/unit/read-response.test.ts, which also holds the predicate that no
 * feature file parses a response by hand any more.
 *
 * The case that motivated this is the one that is easiest to miss: a function
 * killed by the platform's duration limit, or a body rejected before the app
 * runs, returns something that is not JSON at all with a status that is not the
 * app's. `malformed` exists so that shape is named rather than reported as a
 * parse failure in the feature's own words.
 */
export interface ApiFailure {
  status: number;
  code?: string;
  message?: string;
  /** The body was not JSON — a platform-level rejection, not an app error. */
  malformed: boolean;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; failure: ApiFailure };

/** The envelope every route returns on error: `{ error: { code, message }, requestId }`. */
interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

export async function readApiJson<T>(res: Response): Promise<ApiResult<T>> {
  let body: unknown = null;
  let malformed = false;
  try {
    body = await res.json();
  } catch {
    malformed = true;
  }

  if (!res.ok) {
    const envelope = (malformed ? null : (body as ErrorEnvelope | null)) ?? {};
    return {
      ok: false,
      failure: {
        status: res.status,
        code: envelope.error?.code,
        message: envelope.error?.message,
        malformed,
      },
    };
  }
  if (malformed) {
    return { ok: false, failure: { status: res.status, malformed: true } };
  }
  return { ok: true, data: body as T };
}

/**
 * One line a user can act on and a supporter can search for. The status is
 * always included: it is the difference between "the app is broken" and
 * "analyze-code returned 429 RATE_LIMITED", and it is the only number a report
 * can carry without leaking anything.
 */
export function describeApiFailure(failure: ApiFailure): string {
  const parts: string[] = [];
  if (failure.malformed) {
    parts.push(`服务返回了无法解析的响应（HTTP ${failure.status}，通常是函数被提前终止或请求体过大）`);
  } else {
    parts.push(`服务返回 ${failure.status}${failure.code ? `（${failure.code}）` : ""}`);
  }
  if (failure.message) parts.push(failure.message);
  return parts.join("：");
}
