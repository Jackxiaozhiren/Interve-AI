// Type declarations for ./audit-facts.mjs (plain-node ESM + tsc types).

export interface DirtyEntry {
  path: string;
  status: string;
  /** Short sha of the last commit touching this path; null for untracked files. */
  lastTouch: string | null;
  ageDays: number | null;
}

export interface FactLeaves {
  [dottedKey: string]: number;
}

export interface RatchetViolation {
  key: string;
  kind: "ceiling" | "floor";
  actual: number | null;
  limit: number;
  problem: "debt_grew" | "guard_shrank" | "key_no_longer_measured";
}

export interface Facts {
  generatedAt: string;
  git: {
    head: string | null;
    branch: string | null;
    aheadBehind: string;
    dirty: DirtyEntry[];
  };
  runtime: {
    node: string;
    declaredEngines: string | null;
    dockerNodeBase: string | null;
    installed: Record<string, string | null>;
  };
  debt: {
    deprecatedObjectGenFiles: number;
    experimentalRepairTextHits: number;
    selectStarHits: number;
    tsIgnoreHits: number;
    todoMarkers: number;
    anyEscapes: number;
    auditDocsLines: number;
    longestSourceFiles: Array<{ path: string; lines: number }>;
  };
  capabilities: {
    pwa: { serviceWorkerFiles: number; manifestDisplay: string | null; manifestStartUrl: string | null };
    bundler: {
      devScript: string | null;
      buildScript: string | null;
      webpackFlagInScripts: boolean;
      webpackConfigBlock: boolean;
      turbopackConfigBlock: boolean;
    };
    cache: { cacheComponentsFlag: boolean; useCacheDirective: number; cacheTagCalls: number };
    boundaries: {
      pages: number;
      dynamicSegmentPages: number;
      errorFiles: number;
      loadingFiles: number;
      globalErrorFiles: number;
    };
    networkLayer: { abortControllerInApiClient: number; rawFetchCalls: number; clientComponentFiles: number };
    untestedChatCallbacks: string[];
    warnings: string[];
  };
  meta: { dirtyEntries: number; sourceFiles: number };
}

/** Ratchet-eligible dotted keys and what each one guards. */
export const RATCHET_KEYS: Record<string, string>;

export function collectFacts(): Facts;
export function numericLeaves(obj: unknown, prefix?: string, out?: FactLeaves): FactLeaves;
export function evaluateRatchet(
  facts: Facts,
  limits: { ceiling?: Record<string, number>; floor?: Record<string, number> } | null,
): { violations: RatchetViolation[]; leaves: FactLeaves };
