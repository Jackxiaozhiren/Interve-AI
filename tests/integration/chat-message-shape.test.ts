// The interview loop and /chat both post `useChat` transports to
// /api/interview-chat, and `useChat` sends UIMessages: {id, role, parts:[…]}.
// The route used to satisfy `streamText`'s `messages` parameter with a cast —
// `as ModelMessage[]` — which compiles and is wrong at runtime, because
// ModelMessage wants {role, content} and streamText validates it. Every real
// turn therefore died as AI_InvalidPromptError before a provider was contacted,
// which no keyless check could see: the mock lane returns a canned stream before
// validation, and the browser specs assert the UI, not the answer.
//
// Reproduced before being fixed, keyless, by posting both shapes:
//   parts-shaped body   -> AI_InvalidPromptError (never reached a provider)
//   content-shaped body -> AI_LoadAPIKeyError     (reached one, as expected keyless)
// After the conversion both shapes reach the provider. The assertions below do
// not read those logs: they capture the arguments the route hands to streamText.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { getSessionSecret, SESSION_COOKIE, signSession } from "../../src/lib/api/session";
import { POST as interviewChat } from "../../src/app/api/interview-chat/route";
import { resetRateLimits } from "../../src/lib/api/rate-limit";

/**
 * The contract under test is what the route hands to `streamText`, so that is
 * where the assertion sits. Asserting on the response body instead is weak in a
 * way the falsification battery exposed: keyless, both the good and the bad path
 * return the identical frame `{"type":"error","errorText":"An error occurred."}`,
 * and reverting the conversion only changes which error class the server logs —
 * `AI_InvalidPromptError` becomes `AI_TypeValidationError`. A body-text assertion
 * written against one name stayed green through the other.
 */
const GREETING = "您好，我们开始吧。";
const TURN = "请介绍一次你处理过的线上故障。";

const captured: Array<{ messages: unknown }> = [];

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    streamText: (opts: { messages?: unknown }) => {
      captured.push({ messages: opts.messages });
      // A minimal result stand-in: the route only calls toUIMessageStreamResponse()
      // and reads `.usage` through logStreamUsage, which tolerates anything thenable.
      return {
        toUIMessageStreamResponse: () =>
          new Response(['data: {"type":"finish"}', ""].join("\n"), {
            headers: { "content-type": "text/event-stream" },
          }),
        usage: Promise.resolve({}),
      } as never;
    },
  };
});

async function signedCookie(): Promise<string> {
  // Sign with the same resolver the guard uses. Hard-coding a guess here made
  // every request 401, and because a 401 body contains no schema error the
  // assertions below would have passed on an unauthenticated call — a guard that
  // green-lights a request it never let in is worse than no guard.
  const secret = getSessionSecret();
  if (!secret) throw new Error("getSessionSecret() returned null — this suite runs outside production NODE_ENV");
  const signed = await signSession(
    { id: "33333333-3333-3333-3333-333333333333", email: "shape@test", username: "shape" },
    secret
  );
  return `${SESSION_COOKIE}=${encodeURIComponent(signed)}`;
}

function req(body: unknown, cookie: string): Request {
  return new Request("http://test/api/interview-chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
      "x-forwarded-for": "10.9.9.9",
    },
    body: JSON.stringify(body),
  });
}

// The mock must be off: it short-circuits the call whose validation is under test.
let hadMock: string | undefined;
beforeEach(() => {
  resetRateLimits();
  hadMock = process.env.AI_MOCK;
  delete process.env.AI_MOCK;
});
afterEach(() => {
  if (hadMock === undefined) delete process.env.AI_MOCK;
  else process.env.AI_MOCK = hadMock;
});

function modelMessagesOf(capturedMessages: unknown) {
  expect(Array.isArray(capturedMessages), "streamText was not called with an array").toBe(true);
  return capturedMessages as Array<Record<string, unknown>>;
}

/**
 * `convertToModelMessages` emits `content` as a part array, not a string — the
 * shape is the producer's to choose, so the assertion flattens it rather than
 * restating an assumption about it. What must NOT be there is `parts`: that is
 * the UIMessage field the old cast left in place, and the reason the provider
 * rejected the prompt.
 */
function textOf(message: Record<string, unknown>): string {
  const content = message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => ((part as { type?: string; text?: string }).type === "text" ? (part as { text: string }).text : ""))
      .join("");
  }
  throw new Error(`unexpected content shape: ${JSON.stringify(content)}`);
}

describe("interview-chat converts what useChat actually sends", () => {
  beforeEach(() => {
    captured.length = 0;
  });

  it("a parts-only UIMessage turn reaches the provider as a ModelMessage", async () => {
    const cookie = await signedCookie();
    const res = await interviewChat(
      req(
        {
          messages: [
            { id: "1", role: "assistant", parts: [{ type: "text", text: GREETING }] },
            { id: "2", role: "user", parts: [{ type: "text", text: TURN }] },
          ],
          model: "glm-4-flash",
        },
        cookie
      )
    );
    expect(res.status).toBe(200);
    expect(captured.length, "the route never called streamText").toBe(1);
    const sent = modelMessagesOf(captured[0]!.messages);
    expect(sent.map((m) => m.role)).toEqual(["assistant", "user"]);
    // The defect: a cast leaves `parts` on the object and no `content`, which the
    // ModelMessage schema rejects.
    for (const m of sent) expect(m, JSON.stringify(m)).not.toHaveProperty("parts");
    expect(sent.map(textOf)).toEqual([GREETING, TURN]);
  });

  it("a content-only legacy turn survives the same conversion", async () => {
    const cookie = await signedCookie();
    const res = await interviewChat(
      req({ messages: [{ role: "assistant", content: GREETING }, { role: "user", content: TURN }], model: "glm-4-flash" }, cookie)
    );
    expect(res.status).toBe(200);
    expect(captured.length, "the route never called streamText").toBe(1);
    const sent = modelMessagesOf(captured[0]!.messages);
    expect(sent.map(textOf)).toEqual([GREETING, TURN]);
    for (const m of sent) expect(m, JSON.stringify(m)).not.toHaveProperty("parts");
  });

  it("refuses an empty transcript instead of inventing one", async () => {
    const cookie = await signedCookie();
    const res = await interviewChat(req({ messages: [], model: "glm-4-flash" }, cookie));
    expect(res.status).toBe(400);
    expect(captured.length, "an empty transcript must not reach the provider").toBe(0);
  });
});

describe("no API route casts transport messages into ModelMessage[]", () => {
  function routes(dir: string, out: string[]): string[] {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) routes(full, out);
      else if (entry === "route.ts") out.push(full);
    }
    return out;
  }

  it("casts nothing, and the scan is not blind", () => {
    const root = path.join(process.cwd(), "src/app/api");
    const files = routes(root, []);
    // Sanity: the scan must see the real route count, or "no offenders" means nothing.
    expect(files.length).toBeGreaterThanOrEqual(15);
    const offenders = files
      .map((f) => {
        // Strip comments: this file's own rationale quotes the forbidden cast,
        // and a scan that reads prose as code reports a defect that is a sentence.
        const src = readFileSync(f, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, " ")
          .replace(/^\s*\/\/.*$/gm, " ");
        return /as\s+ModelMessage\s*\[\]/.test(src) ? path.relative(process.cwd(), f) : null;
      })
      .filter((v): v is string => v !== null);
    expect(
      offenders,
      `convert with convertToModelMessages(); a cast compiles and fails at runtime: ${offenders.join(", ")}`
    ).toEqual([]);
  });
});
