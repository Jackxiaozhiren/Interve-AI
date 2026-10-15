/**
 * Which interviewer is speaking, read off the label the model was told to emit.
 *
 * `src/ai/prompts/interview.ts` instructs the model to begin every reply with
 * one of `[Tech]`, `[HR]`, `[Product]` so the room can light the right persona.
 * The page used to match those three strings inline, which meant the two ends of
 * one contract could disagree without anything noticing: a relabelled prompt
 * leaves the room stuck on the previous persona, and a typo in the matcher drops
 * a persona silently. `tests/unit/expert-labels.test.ts` compares the two sets.
 */
export type AIExpert = 'tech' | 'hr' | 'product' | 'system';

/** Label the prompt demands -> the persona it selects. `'system'` is the standby default. */
export const LABEL_TO_EXPERT: Record<string, AIExpert> = {
  '[Tech]': 'tech',
  '[HR]': 'hr',
  '[Product]': 'product',
};

/** The persona a reply announces, or null when it opens with no known label. */
export function expertFromMessage(text: string): AIExpert | null {
  for (const [label, expert] of Object.entries(LABEL_TO_EXPERT)) {
    if (text.startsWith(label)) return expert;
  }
  return null;
}
