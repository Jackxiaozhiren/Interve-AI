// Phase 11: evaluator agreement + stability metrics (27.2, 27.3).
//
// Pure functions over 1-5 anchor scores. All thresholds that consume these
// metrics live in the eval runners and are marked PROVISIONAL until human
// baselines exist — the math here makes no such claims.

/** Quadratic-weighted Cohen's kappa for ordinal 1-5 anchor scores. */
export function weightedKappaQuadratic(a: number[], b: number[], categories = 5): number {
  if (a.length !== b.length || a.length === 0) return NaN;
  const n = a.length;
  const observed: number[][] = Array.from({ length: categories }, () => Array(categories).fill(0));
  for (let i = 0; i < n; i++) {
    const x = Math.min(categories, Math.max(1, Math.round(a[i]))) - 1;
    const y = Math.min(categories, Math.max(1, Math.round(b[i]))) - 1;
    observed[x][y] += 1;
  }
  const rowSum = observed.map((r) => r.reduce((p, c) => p + c, 0));
  const colSum = observed[0].map((_, j) => observed.reduce((p, r) => p + r[j], 0));
  const weight = (i: number, j: number) => ((i - j) ** 2) / ((categories - 1) ** 2);
  let obsDis = 0;
  let expDis = 0;
  for (let i = 0; i < categories; i++) {
    for (let j = 0; j < categories; j++) {
      obsDis += weight(i, j) * observed[i][j];
      expDis += weight(i, j) * ((rowSum[i] * colSum[j]) / n);
    }
  }
  if (expDis === 0) return obsDis === 0 ? 1 : 0;
  return 1 - obsDis / expDis;
}

/** Rank values with averaged tied ranks. */
function ranks(xs: number[]): number[] {
  const order = xs.map((v, i) => ({ v, i })).sort((p, q) => p.v - q.v);
  const out = new Array<number>(xs.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].v === order[i].v) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[order[k].i] = avg;
    i = j + 1;
  }
  return out;
}

/** Spearman rank correlation (Pearson on averaged ranks). */
export function spearman(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return NaN;
  const rx = ranks(x);
  const ry = ranks(y);
  const n = x.length;
  const mx = rx.reduce((a, b) => a + b, 0) / n;
  const my = ry.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  if (dx === 0 || dy === 0) return 0;
  return num / Math.sqrt(dx * dy);
}

export function mae(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return NaN;
  return a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;
}

export interface Agreement {
  exact: number;
  adjacent: number;
}

/** Exact + adjacent (±1) agreement fractions for anchor scores. */
export function exactAdjacentAgreement(a: number[], b: number[]): Agreement {
  if (a.length !== b.length || a.length === 0) return { exact: NaN, adjacent: NaN };
  let exact = 0;
  let adjacent = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(Math.round(a[i]) - Math.round(b[i]));
    if (d === 0) exact++;
    if (d <= 1) adjacent++;
  }
  return { exact: exact / a.length, adjacent: adjacent / a.length };
}

/** Population standard deviation (stability spread across repeats). */
export function stdev(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}
