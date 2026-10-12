/**
 * Passing a component its own default is not a decision.
 *
 * `RoomHeader` rendered `<SystemHealthIndicator isOnline={true} …>` while
 * `isOnline` defaulted to `true`, so the value carried no information and the
 * `navigator.onLine && isOnline` it fed was an AND with a constant. That shape
 * is easy to write believing it documents intent, and easy to leave behind when
 * the intent goes away, so it is now measured rather than remembered: a boolean
 * literal at a call site is allowed only when it says something the default does.
 *
 * Scoped deliberately to components this repo declares. Recharts' `axisLine` and
 * `tick` are set to literals twenty-odd times over and every one of those is a
 * styling decision about someone else's default; a gate that counted them would
 * be raised rather than read. Because the scope is a filter, its own blind spot
 * is asserted: a boolean literal passed to a tag imported from inside this repo
 * that the scan could not explain is reported, so a component shape added later
 * cannot turn this check green by being invisible to it.
 */
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { readRepo, walkRepo } from "./repo-tree";

type Literal = { file: string; line: number; component: string; prop: string; value: string };

/** prop -> the boolean literal it defaults to, for one declared component. */
type Defaults = Map<string, string>;

const boolLiteral = (node: ts.Node | undefined): string | undefined =>
  node?.kind === ts.SyntaxKind.TrueKeyword ? "true"
    : node?.kind === ts.SyntaxKind.FalseKeyword ? "false"
      : undefined;

/**
 * Every boolean literal passed to a component declared in `sources`, split by
 * whether the component already defaults that prop to the same value.
 */
function scanBooleanLiterals(sources: { path: string; text: string }[]): {
  literals: Literal[];
  redundant: Literal[];
  blindSpots: Literal[];
} {
  const declared = new Map<string, Defaults>();
  const passed: Literal[] = [];
  /** Per file: the tags this file pulls from inside the repo, and what they bind. */
  const ownImports = new Map<string, Set<string>>();

  for (const source of sources) {
    const sf = ts.createSourceFile(source.path, source.text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const lineOf = (node: ts.Node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    const local = new Set<string>();
    ownImports.set(source.path, local);

    const recordComponent = (name: ts.Identifier, firstParameter: ts.ParameterDeclaration | undefined) => {
      // Arrow components carry their defaults on the same binding pattern, and
      // four of them exist; a scan that knew only `function X({…})` would certify
      // zero by never seeing a quarter of the app's components.
      const defaults: Defaults = new Map();
      if (firstParameter && ts.isObjectBindingPattern(firstParameter.name)) {
        for (const element of firstParameter.name.elements) {
          if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
            const value = boolLiteral(element.initializer);
            if (value) defaults.set(element.name.text, value);
          }
        }
      }
      declared.set(name.text, defaults);
    };

    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name && /^[A-Z]/.test(node.name.text)) {
        recordComponent(node.name, node.parameters[0]);
      }
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /^[A-Z]/.test(node.name.text)) {
        const init = node.initializer;
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          recordComponent(node.name, init.parameters[0]);
        }
      }
      if (ts.isImportDeclaration(node) && node.importClause && ts.isStringLiteral(node.moduleSpecifier)) {
        const from = node.moduleSpecifier.text;
        const isOwnModule = from.startsWith("@/") || from.startsWith(".") || from.startsWith("~/");
        const bindings = [node.importClause.name, ...(node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings) ? node.importClause.namedBindings.elements.map((e) => e.name) : [])];
        for (const name of bindings) if (name && /^[A-Z]/.test(name.text) && isOwnModule) local.add(name.text);
      }
      if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.initializer && ts.isJsxExpression(node.initializer)) {
        const value = boolLiteral(node.initializer.expression);
        const tag = node.parent.parent.tagName;
        if (value && ts.isIdentifier(tag)) {
          passed.push({ file: source.path, line: lineOf(node), component: tag.text, prop: node.name.text, value });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  const literals = passed.filter((hit) => declared.has(hit.component));
  const redundant = literals.filter((hit) => declared.get(hit.component)?.get(hit.prop) === hit.value);
  // Anything imported from this repo's own modules that the scan did not
  // recognise is a shape it cannot see, and would otherwise hide a violation.
  const blindSpots = passed.filter(
    (hit) => !declared.has(hit.component) && ownImports.get(hit.file)?.has(hit.component)
  );
  return { literals, redundant, blindSpots };
}

const describeHit = (hit: Literal) => `${hit.file}:${hit.line} <${hit.component} ${hit.prop}={${hit.value}}>`;

/** The production corpus, read once for all three verdicts. */
const SRC = scanBooleanLiterals(
  walkRepo("src", (rel) => rel.endsWith(".tsx")).map((path) => ({ path, text: readRepo(path) }))
);

const asText = (hits: Literal[]) => hits.map(describeHit).sort().join(", ");

describe("no call site restates a default", () => {
  it("leaves src/ with nothing to explain", () => {
    expect(SRC.redundant.map(describeHit).sort(), `passing a prop the value it already defaults to: ${asText(SRC.redundant)}`).toEqual([]);
  });

  it("can see every component it is judging", () => {
    expect(SRC.blindSpots.map(describeHit).sort(), `a boolean literal on a repo-owned component this scan does not model: ${asText(SRC.blindSpots)}`).toEqual([]);
  });

  it("is reading real call sites, not an empty corpus", () => {
    expect(SRC.literals.length, "a scan that saw no boolean props at all would report no violations").toBeGreaterThan(0);
  });

  it("catches the redundancy in both declaration shapes and spares the decision", () => {
    const sources = [
      {
        path: "components.tsx",
        text: `
          import { Legend } from "@/components/dashboard/Legend";
          function Card({ streaming = false }: { streaming?: boolean }) { return <i />; }
          const Row = ({ active = true }: { active?: boolean }) => <i />;
          export const use = (
            <div>
              <Card streaming={false} />
              <Row active={true} />
              <Card streaming={true} />
              <Legend dark={true} />
            </div>
          );
        `,
      },
    ];
    const { literals, redundant, blindSpots } = scanBooleanLiterals(sources);
    const names = (hits: Literal[]) => hits.map((h) => `${h.component}.${h.prop}=${h.value}`).sort();
    // `literals` counts only what the scan could explain; Legend is in the
    // corpus but not among the explained shapes, so it belongs to `blindSpots`.
    expect(names(literals)).toEqual(["Card.streaming=false", "Card.streaming=true", "Row.active=true"]);
    expect(names(redundant), "one function-declared and one arrow-declared default restated").toEqual([
      "Card.streaming=false", "Row.active=true",
    ]);
    // Legend is imported from inside the repo but never declared in the scanned
    // corpus, so it is a shape the scan cannot read — and it has to say so.
    expect(names(blindSpots), "an unmodelled repo-owned component is a blind spot, not a pass").toEqual(["Legend.dark=true"]);
  });
});
