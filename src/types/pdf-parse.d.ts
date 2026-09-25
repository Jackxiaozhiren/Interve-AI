// pdf-parse v2 ambient-shaped declaration (runtime 2.4.5 exports a named
// PDFParse class; the @types/pdf-parse v1 callable shape no longer applies).
// Kept minimal to the surface this repo uses; index signature tolerates the
// rest of the v2 result without `any` leakage into callers.
declare module "pdf-parse" {
  export interface PDFParseResult {
    text: string;
    [key: string]: unknown;
  }
  export class PDFParse {
    constructor(options: { data: Buffer | Uint8Array });
    getText(): Promise<PDFParseResult>;
    destroy(): Promise<void>;
  }
}
