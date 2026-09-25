// P2-06 LLM09 vector专项 (static, $0): per-user index isolation pins.
//
// Threat: single in-memory Orama instance + persisted rows — a cross-user
// leak would surface A's resume chunks in B's retrieval (LLM09) and poison
// grounding (LLM07). These tests pin the structural barriers:
// hub namespacing, query-time isolation across re-init, fail-closed query.
import { describe, it, expect } from "vitest";
import {
  initializeKnowledgeHub,
  queryKnowledgeHub,
  resetKnowledgeHub,
  hubIdForUser,
  localHubUserId,
} from "../../src/lib/orama-client";

describe("orama hub partitioning (LLM09)", () => {
  it("namespaces hub ids per user (no global-id reads outside legacy fallback)", () => {
    expect(hubIdForUser("user-A")).toBe("resume-index:user-A");
    expect(hubIdForUser("user-B")).toBe("resume-index:user-B");
    expect(hubIdForUser("user-A")).not.toBe(hubIdForUser("user-B"));
    expect(hubIdForUser(null)).toBe("resume-index");
  });

  it("returns null user without a browser session (node-safe)", () => {
    expect(localHubUserId()).toBeNull();
  });

  it("query fails closed when uninitialized (never empty-success)", async () => {
    resetKnowledgeHub();
    await expect(queryKnowledgeHub("anything")).rejects.toThrow(/not initialized/);
  });

  it("chunks of user A never surface in user B retrieval", async () => {
    await initializeKnowledgeHub("Alice worked on alpha falcon reactors", "user-A");
    const hitsA = await queryKnowledgeHub("alpha falcon", 5);
    expect(hitsA.join(" ")).toContain("alpha");

    resetKnowledgeHub();
    await initializeKnowledgeHub("Bob worked on beta harbor logistics", "user-B");
    const hitsB = await queryKnowledgeHub("alpha falcon", 5);
    expect(hitsB.join(" ")).not.toContain("alpha");
    const hitsBeta = await queryKnowledgeHub("beta harbor", 5);
    expect(hitsBeta.join(" ")).toContain("beta");
    resetKnowledgeHub();
  }, 30000);
});
