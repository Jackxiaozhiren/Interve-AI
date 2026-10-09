import { checkRateLimit, getClientIp } from "@/lib/api/rate-limit";
import { getSessionFromRequest } from "@/lib/api/session";
import { getRequestId } from "@/lib/api/request-id";
import { okResponse, errorResponse } from "@/lib/api/errors";
import { logApi, usageOf } from "@/lib/api/logging";
import { classifyUpstreamError } from "@/lib/api/classify-error";
import { zhipu, MODEL_IDS, FALLBACK_MAX_RETRIES } from "@/ai/providers/registry";
import { isMockEnabled, mockJson, MOCK_PAYLOADS } from "@/ai/providers/mock";
import { buildOcrInstruction } from "@/ai/prompts/resume";
import { PDFParse } from "pdf-parse";
import { MAX_RESUME_BYTES } from "@/lib/uploads";
import { shouldOcrFallback, stripPageMarkers } from "@/lib/resume/text-quality";

export const runtime = 'nodejs';
// The OCR branch waits on a provider, like every other analyzer route that
// declares a budget (60-170s). Without it the platform kills the function
// mid-call and the client receives a body it cannot parse as JSON.
export const maxDuration = 100;

const ROUTE = "parse-resume";
// Matches the "5MB" claim already shown in the setup UI.
const MAX_FILE_BYTES = MAX_RESUME_BYTES;

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const startTime = performance.now();
  const done = (status: number, extra?: { reason?: string; cause?: string; model?: string; inputTokens?: number; outputTokens?: number }) =>
    logApi(ROUTE, { requestId, status, latencyMs: Math.round(performance.now() - startTime), ...extra });

  // 1. Rate limit (pre-auth).
  const rl = checkRateLimit(ROUTE, getClientIp(req), { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    done(429, { reason: "rate_limited" });
    return errorResponse("RATE_LIMITED", "Too many requests. Please retry later.", 429, requestId, {
      "Retry-After": String(Math.max(1, Math.ceil(rl.retryAfterMs / 1000))),
    });
  }

  // 2. Session.
  const session = await getSessionFromRequest(req);
  if (!session) {
    done(401, { reason: "unauthenticated" });
    return errorResponse("UNAUTHORIZED", "Authentication required. Please sign in.", 401, requestId);
  }
  if (isMockEnabled()) return mockJson(ROUTE, MOCK_PAYLOADS[ROUTE], requestId);

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || typeof file === "string") {
      done(400, { reason: "missing_file" });
      return errorResponse("BAD_REQUEST", "No file provided", 400, requestId);
    }

    const isPdf = file.type === "application/pdf";
    const isImage = file.type.startsWith("image/");

    if (!isPdf && !isImage) {
      done(400, { reason: "unsupported_type" });
      return errorResponse("BAD_REQUEST", "Only PDF and image files are supported", 400, requestId);
    }

    // 3. Size cap enforced server-side (previously UI text only).
    if (typeof file.size === "number" && file.size > MAX_FILE_BYTES) {
      done(413, { reason: "file_too_large" });
      return errorResponse("PAYLOAD_TOO_LARGE", "File exceeds 5MB", 413, requestId);
    }

    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_FILE_BYTES) {
      done(413, { reason: "file_too_large" });
      return errorResponse("PAYLOAD_TOO_LARGE", "File exceeds 5MB", 413, requestId);
    }
    // SVG is XML/active content: never send to OCR or parse as document.
    if (file.type === "image/svg+xml") {
      done(400, { reason: "unsupported_type" });
      return errorResponse("BAD_REQUEST", "SVG images are not supported", 400, requestId);
    }
    const buffer = Buffer.from(arrayBuffer);

    let text = "";
    let isOcrFallback = false;
    // H3.2: OCR token accounting rides the single terminal done(200) line.
    let ocrExtra: { model?: string; inputTokens?: number; outputTokens?: number } = {};

    if (isPdf) {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      text = stripPageMarkers(result.text || "");
    }

    // A text layer with too few characters is a scanned page, not a thin
    // resume; the script-aware quality test in text-quality.ts owns that call.
    if (isImage || shouldOcrFallback(text)) {
       isOcrFallback = true;
       try {
         const { generateText } = await import('ai');

         // Using Zhipu's multimodal model (free/cheap tier) for OCR.
          const { text: ocrText, usage: ocrUsage } = await generateText({
           model: zhipu().chat(MODEL_IDS.zhipuVisionFlash),
           maxRetries: FALLBACK_MAX_RETRIES,
           messages: [
             {
               role: 'user',
               content: [
                 { type: 'text', text: buildOcrInstruction() },
                 { type: 'image', image: buffer },
               ],
             },
           ],
         });
          text = ocrText;
          ocrExtra = { model: MODEL_IDS.zhipuVisionFlash, ...usageOf(ocrUsage) };
        } catch (ocrError) {
          done(422, { reason: "ocr_failed", cause: classifyUpstreamError(ocrError) });
          return errorResponse("UPSTREAM_ERROR", "Failed to extract text even with OCR fallback. This might be a corrupted file.", 422, requestId);
        }
     }

    // Cap extracted text so one document cannot blow up downstream prompts.
    if (text.length > 60000) text = text.slice(0, 60000);
    done(200, ocrExtra);
    return okResponse({ text: text, isOcrFallback }, requestId);
  } catch (err) {
    // Name the failure: a bare "internal" is why a production 500 on this route
    // stayed undiagnosable. The message goes to the log, not the client.
    const name = err instanceof Error ? err.name : typeof err;
    done(500, { reason: `internal:${name}`, cause: classifyUpstreamError(err) });
    return errorResponse("INTERNAL", "Failed to parse resume", 500, requestId);
  }
}
