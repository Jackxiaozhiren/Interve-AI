/**
 * The wrapper that makes the quota badge work in the interview room.
 *
 * `readApiJson` records the allowance header for JSON lanes, but a stream is
 * handed straight to the transport and never passes through it. Before this
 * wrapper the room's badge could only show a reading left by an earlier JSON
 * call — never the one from `interview-chat`'s response that opens the stream,
 * which is the call that actually spends the allowance.
 *
 * Two properties matter, and both are tested rather than assumed:
 *
 *   1. **The body is returned untouched.** Cloning a live stream buffers it, and
 *      the transport would then receive an already-drained body. The assertion is
 *      that the reader can still consume the stream after the wrapper returns.
 *   2. **A transport failure still surfaces.** Swallowing it to record a header
 *      would turn a failed send into a silent one.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getQuota, quotaAwareFetch, resetQuota } from "@/lib/api/quota";

function streamResponse(headers: Record<string, string>): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("data: hello\n\n"));
      controller.close();
    },
  });
  return new Response(body, { headers });
}

beforeEach(() => {
  resetQuota();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("quotaAwareFetch", () => {
  it("records the reading and hands back the same response, undrained", async () => {
    const original = streamResponse({
      "RateLimit-Remaining": "42",
      "RateLimit-Reset": "30",
    });
    vi.stubGlobal("fetch", vi.fn(async () => original));

    const res = await quotaAwareFetch("/api/interview-chat");

    expect(res).toBe(original);
    expect(res.bodyUsed, "reading the header must not consume the stream").toBe(false);
    expect(getQuota()).toEqual({ remaining: 42, resetSeconds: 30 });

    // The transport still gets its bytes.
    expect(await res.text()).toContain("hello");
  });

  it("leaves the store alone when the response carries no header", async () => {
    const original = new Response("{}");
    vi.stubGlobal("fetch", vi.fn(async () => original));

    await quotaAwareFetch("/api/anything");
    expect(getQuota()).toBeNull();
  });

  it("does not turn a failed send into a silent one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      })
    );
    await expect(quotaAwareFetch("/api/interview-chat")).rejects.toThrow("fetch failed");
    expect(getQuota()).toBeNull();
  });
});

describe("the room actually uses it", () => {
  it("wires the wrapper into the transport the room builds", async () => {
    const { readRepo } = await import("./repo-tree");
    const transport = readRepo("src/lib/api/chat-transport.ts");
    expect(
      transport,
      "the transport must receive the wrapper, or the badge cannot see the stream's reading"
    ).toMatch(/new DefaultChatTransport\(\{[\s\S]{0,400}fetch:\s*quotaAwareFetch/);

    const page = readRepo("src/app/interview/page.tsx");
    expect(page, "the room must build its transport through that factory").toContain(
      "createQuotaAwareTransport({"
    );
  });
});
