/** MSW node server for vitest (started per-test-file, never in production). */
import { setupServer } from "msw/node";
import { dsaHandlers } from "@/mocks/handlers";

export const dsaServer = setupServer(...dsaHandlers);
