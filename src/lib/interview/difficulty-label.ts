/**
 * The interview loop badge. Lives here rather than inline in
 * src/app/interview/page.tsx because the page has no room left for logic that
 * needs its own tests: the inline version capitalised the difficulty into an i18n
 * key name and matched it with a four-way ternary, which is a string contract no
 * compiler checks.
 *
 * The dictionary is typed structurally on purpose — the page passes whatever
 * `useLanguage()` gives it, and this module must not depend on the provider.
 */
type BadgeDictionary = {
  interview: {
    turn: string;
    difficultyEasy: string;
    difficultyMedium: string;
    difficultyHard: string;
    difficultyExpert: string;
  };
};

export function difficultyLabel(t: BadgeDictionary, difficulty?: string): string {
  switch (difficulty) {
    case "easy":
      return t.interview.difficultyEasy;
    case "medium":
      return t.interview.difficultyMedium;
    case "hard":
      return t.interview.difficultyHard;
    default:
      return t.interview.difficultyExpert;
  }
}

export function loopBadge(t: BadgeDictionary, turnCount: number, difficulty?: string): string {
  return `${t.interview.turn} ${turnCount} · ${difficultyLabel(t, difficulty)}`;
}
