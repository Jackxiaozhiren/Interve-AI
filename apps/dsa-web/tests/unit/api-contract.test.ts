// @vitest-environment node
// MSW node server must run in a pure node env: under jsdom, fetch crosses
// realms and undici throws `webidl.util.markAsUncloneable` (Node 20, CI).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dsaServer } from "@/mocks/server";
import {
  fixtureAnalyses,
  fixtureBenchmarks,
  fixtureDatasets,
} from "@/mocks/fixtures";
import {
  checkApiHealth,
  getReplay,
  listAnalyses,
  listBenchmarks,
  listDatasets,
  listReports,
  listRuns,
} from "@/lib/api";

beforeAll(() => dsaServer.listen({ onUnhandledRequest: "error" }));
afterAll(() => dsaServer.close());

describe("API contract via MSW (frozen lib/api.ts)", () => {
  it("GET /health → up", async () => {
    await expect(checkApiHealth()).resolves.toBe("up");
  });

  it("GET /datasets → ≥5 fixtures", async () => {
    const rows = await listDatasets();
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows[0]).toEqual(fixtureDatasets[0]);
  });

  it("GET /analysis → analyses list", async () => {
    await expect(listAnalyses()).resolves.toEqual(fixtureAnalyses);
  });

  it("GET /benchmarks → ≥5 rows", async () => {
    const rows = await listBenchmarks();
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows).toEqual(fixtureBenchmarks);
  });

  it("GET /reports and /runs → analysis-shaped lists", async () => {
    await expect(listReports()).resolves.toEqual(fixtureAnalyses);
    await expect(listRuns()).resolves.toEqual(fixtureAnalyses);
  });

  it("GET /runs/:id/replay → full RunDetail", async () => {
    const detail = await getReplay("run_001");
    expect(detail.id).toBe("run_001");
    expect(detail.status).toBe("COMPLETED");
    expect(detail.evidence?.length).toBeGreaterThan(0);
  });
});
