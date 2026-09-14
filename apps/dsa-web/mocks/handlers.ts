/**
 * MSW handlers for the frozen DSA contract (`openapi.json`).
 * Intercepts `http://localhost:8000` ONLY when the MSW server/worker is
 * started (vitest) or when `page.route` replay uses these fixtures (Playwright).
 * Default: OFF — never pollutes the real API.
 */
import { http, HttpResponse } from "msw";
import {
  fixtureAnalyses,
  fixtureBenchmarks,
  fixtureDatasetProfile,
  fixtureDatasets,
  fixtureRunDetails,
} from "@/mocks/fixtures";

export const DSA_API = "http://localhost:8000";

function json(data: Parameters<typeof HttpResponse.json>[0], status = 200, requestId = "mock-req") {
  return HttpResponse.json(data, {
    status,
    headers: { "x-request-id": requestId },
  });
}

export const dsaHandlers = [
  http.get(`${DSA_API}/health`, () => json({ status: "ok" })),

  http.get(`${DSA_API}/datasets`, () => json(fixtureDatasets)),
  http.post(`${DSA_API}/datasets`, () => json(fixtureDatasets[0], 201)),
  http.get(`${DSA_API}/datasets/:id`, ({ params }) =>
    json(fixtureDatasetProfile(String(params.id))),
  ),

  http.get(`${DSA_API}/analysis`, () => json(fixtureAnalyses)),
  http.post(`${DSA_API}/analysis`, () => json(fixtureAnalyses[0], 201)),
  http.get(`${DSA_API}/analysis/:runId`, ({ params }) => {
    const run =
      fixtureRunDetails.find((r) => r.id === String(params.runId)) ??
      fixtureRunDetails[0];
    return json(run);
  }),

  http.get(`${DSA_API}/benchmarks`, () => json(fixtureBenchmarks)),
  http.get(`${DSA_API}/reports`, () => json(fixtureAnalyses)),
  http.get(`${DSA_API}/runs`, () => json(fixtureAnalyses)),
  http.get(`${DSA_API}/runs/:id`, ({ params }) => {
    const run =
      fixtureRunDetails.find((r) => r.id === String(params.id)) ??
      fixtureRunDetails[0];
    return json(run);
  }),
  http.get(`${DSA_API}/runs/:id/replay`, ({ params }) => {
    const run =
      fixtureRunDetails.find((r) => r.id === String(params.id)) ??
      fixtureRunDetails[0];
    return json(run);
  }),
];
