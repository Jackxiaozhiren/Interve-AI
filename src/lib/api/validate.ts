// Phase 2 API hardening: bounded JSON body parsing + Zod validation (P0-3).
import { z } from "zod";

export type BodyError =
  | { code: "PAYLOAD_TOO_LARGE"; status: 413; message: string }
  | { code: "INVALID_JSON"; status: 400; message: string }
  | { code: "VALIDATION_FAILED"; status: 400; message: string }
  | { code: "BAD_REQUEST"; status: 400; message: string };

function summarizeIssues(error: z.ZodError): string {
  const first = error.issues.slice(0, 3).map((i) => {
    const path = i.path.length > 0 ? i.path.join(".") : "body";
    return `${path}: ${i.message}`;
  });
  return `Invalid request body (${first.join("; ")})`;
}

/**
 * Reads `req` as JSON with a hard byte cap, then validates with `schema`.
 * Checks Content-Length first (cheap reject), then the actual decoded size.
 * Never throws: returns a discriminated error instead.
 */
export async function readJsonBody<T>(
  req: Request,
  schema: z.ZodType<T>,
  maxBytes: number
): Promise<{ ok: true; data: T } | { ok: false; error: BodyError }> {
  const declared = req.headers.get("content-length");
  if (declared !== null) {
    const n = Number(declared);
    if (Number.isFinite(n) && n > maxBytes) {
      return {
        ok: false,
        error: {
          code: "PAYLOAD_TOO_LARGE",
          status: 413,
          message: `Request body exceeds ${maxBytes} bytes`,
        },
      };
    }
  }
  let text: string;
  try {
    text = await req.text();
  } catch {
    return { ok: false, error: { code: "BAD_REQUEST", status: 400, message: "Failed to read request body" } };
  }
  if (new TextEncoder().encode(text).length > maxBytes) {
    return {
      ok: false,
      error: {
        code: "PAYLOAD_TOO_LARGE",
        status: 413,
        message: `Request body exceeds ${maxBytes} bytes`,
      },
    };
  }
  let json: unknown;
  try {
    json = text.length === 0 ? undefined : JSON.parse(text);
  } catch {
    return { ok: false, error: { code: "INVALID_JSON", status: 400, message: "Request body is not valid JSON" } };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION_FAILED", status: 400, message: summarizeIssues(parsed.error) },
    };
  }
  return { ok: true, data: parsed.data };
}
