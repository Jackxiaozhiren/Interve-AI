/**
 * What leaves the product when a candidate shares a report.
 *
 * The owner decision (2026-11-13) was explicit: the shared link carries the
 * report but NOT the verbatim evidence and NOT the per-question review. Those
 * two are the parts that quote the candidate's own words — company names,
 * project names, a colleague's name — and a link is forwarded far more easily
 * than a file.
 *
 * So this module builds a whitelist projection, never a redaction of the whole
 * row. A new field added to `EvaluationView` does not appear in a shared report
 * unless someone adds it here and reasons about it; the default is exclusion.
 *
 * The token design matches: 32 random bytes, stored only as a SHA-256 hash.
 * There is no signing secret to leak or rotate, and a dump of `report_shares`
 * cannot be replayed into a working link.
 */
import type { EvaluationView } from "@/lib/eval-compat";
import type { Interview } from "@/lib/db";

/** Owner decision: a link is good for a week. */
export const SHARE_TTL_DAYS = 7;

/** Owner decision: at most twenty opens, so "sent to one person" stays that. */
export const SHARE_MAX_VIEWS = 20;

/** Payload version, so a future shape change can be told apart from this one. */
export const SHARE_PAYLOAD_VERSION = 1;

export interface SharedDimension {
  id: string;
  name: string;
  score100: number;
  anchorLevel: number | null;
  confidence: string;
  /** The reasoning, never the quotes it rests on. */
  rationale: string;
}

export interface SharePayload {
  version: number;
  generatedAt: string;
  readiness: {
    label: string | null;
    rationale: string | null;
    average: number | null;
    confidence: string | null;
  };
  dimensions: SharedDimension[];
  strengths: string[];
  weaknesses: string[];
  nextDrills: string[];
  roadmap: { technical: string[]; behavioral: string[]; resources: string[] } | null;
}

/**
 * Build the projection that is safe to hand to someone else.
 *
 * Deliberately absent: `title` (the candidate often puts the company in it),
 * `evidence` (verbatim quotes), `qaReview` (question + answer + flaws),
 * `transcript`, `radarScores`, delivery metrics, and every identifier.
 */
export function buildSharePayload(
  view: EvaluationView,
  roadmap: Interview["trainingRoadmap"] | undefined,
  now: Date = new Date()
): SharePayload {
  return {
    version: SHARE_PAYLOAD_VERSION,
    generatedAt: now.toISOString(),
    readiness: {
      label: view.readinessLabel,
      rationale: view.readinessRationale,
      average: view.average,
      confidence: view.confidence,
    },
    dimensions: view.dimensions.map((dim) => ({
      id: dim.id,
      name: dim.name,
      score100: dim.score100,
      anchorLevel: dim.anchorLevel,
      confidence: dim.confidence,
      rationale: dim.rationale,
    })),
    strengths: [...view.strengths],
    weaknesses: [...view.weaknesses],
    nextDrills: [...view.nextDrills],
    roadmap: roadmap
      ? {
          technical: [...roadmap.technical],
          behavioral: [...roadmap.behavioral],
          resources: [...roadmap.resources],
        }
      : null,
  };
}

/** ISO timestamp `days` from `now` (injectable so tests do not sleep). */
export function shareExpiry(now: Date = new Date(), days: number = SHARE_TTL_DAYS): string {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * 32 random bytes as base64url (43 chars, 256 bits of entropy).
 *
 * Random rather than signed: the database stores only the hash, so the value
 * itself is the credential and needs no verifier secret on the server.
 */
export function generateShareToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/** SHA-256 of the token, lowercase hex. The only form the database ever sees. */
export async function hashShareToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** The link a candidate copies. Trailing slash on the origin is tolerated. */
export function shareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/s/${token}`;
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Cheap shape check before spending a hash + database round trip. */
export function looksLikeShareToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}
