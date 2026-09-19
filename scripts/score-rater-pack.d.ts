// Type declarations for ./score-rater-pack.mjs (plain-node ESM + tsc types).
export const READINESS_LEVELS: string[];
export const GRADUATION_KAPPA: number;

export interface FleissResult {
  kappa: number;
  subjectsUsed: number;
  subjectsTotal: number;
}

export interface AlphaResult {
  alpha: number;
  pairable: number;
}

export interface SheetRow {
  rater: string;
  caseId: string;
  item: string;
  value: string;
}

export interface ItemScore {
  item: string;
  k: number;
  kappa: number;
  alpha: number;
  subjectsUsed: number;
  subjectsTotal: number;
}

export interface PracticeScore {
  caseId: string;
  n: number;
  meanAbsDiff: number;
  within10: number;
}

export interface CellDisagreement {
  caseId: string;
  item: string;
  k: number;
  raters: number;
  agreement: number;
}

export interface PackResult {
  raters: string[];
  nRaters: number;
  nInvalid: number;
  dimensions: ItemScore[];
  readiness: ItemScore | null;
  meanDimKappa: number;
  graduationAdvisory: string;
  practiceScores: PracticeScore[];
  disagreements: CellDisagreement[];
}

export function fleissKappaQuadratic(ratings: (number | null | undefined)[][], k: number): FleissResult;
export function krippendorffAlphaOrdinal(ratings: (number | null | undefined)[][], k: number): AlphaResult;
export function parseScoreSheet(text: string): SheetRow[];
export function scoreSheets(sheetTexts: string[]): PackResult;
