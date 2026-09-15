// Phase 5 prompt registry: document OCR extraction instruction.
export const RESUME_PROMPT_ID = "parse-resume";
export const RESUME_PROMPT_VERSION = "1.0.0";

export function buildOcrInstruction(): string {
  return 'Extract all the text from this document accurately. Do not summarize, just extract the raw text.';
}
