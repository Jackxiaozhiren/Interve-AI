// Type declarations for ./quota-ledger.mjs (plain-node ESM + tsc types).
export type QuotaProvider = "zhipu" | "gemini";

export interface QuotaCheck {
  ok: boolean;
  bypassed: boolean;
  provider: QuotaProvider;
  window: string;
  budget: number;
  used: number;
  remaining: number;
  need: number;
}

export interface QuotaRecord {
  provider: QuotaProvider;
  window: string;
  used: number;
  recorded: number;
  bypassed: boolean;
}

export interface QuotaStatus {
  provider: QuotaProvider;
  window: string;
  budget: number;
  used: number;
  remaining: number;
}

export function ptDayKey(now?: Date): string;
export function isProvider(p: string): p is QuotaProvider;
export function providerBudget(provider: QuotaProvider): number;
export function ledgerPath(): string;
export function isDisabled(): boolean;
export function readLedger(ledgerFile?: string): { version: 1; windows: Partial<Record<QuotaProvider, { window: string; used: number }>> };
export function quotaCheck(provider: QuotaProvider, need?: number, opts?: { ledgerFile?: string; now?: Date }): QuotaCheck;
export function quotaRecord(provider: QuotaProvider, count?: number, opts?: { ledgerFile?: string; now?: Date }): QuotaRecord;
export function quotaStatus(opts?: { ledgerFile?: string; now?: Date }): QuotaStatus[];
