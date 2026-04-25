"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════
   Interve AI — Code Block Component
   Syntax display + copy + line numbers
   Luminous Light Design System v1.0
   
   Syntax highlighting colors:
   - Keywords:  #165DFF (blue)
   - Strings:   #00B42A (green)
   - Comments:  #86909C (gray)
   - Functions: #FF7D00 (orange)
   - Numbers:   #F53F3F (red)
   ═══════════════════════════════════════ */

/* ─── Lightweight regex-based syntax tokenizer ─── */
interface Token {
  type: "keyword" | "string" | "comment" | "function" | "number" | "plain";
  value: string;
}

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "do", "switch", "case", "break", "continue", "new", "this", "class", "extends",
  "import", "export", "default", "from", "async", "await", "try", "catch",
  "finally", "throw", "typeof", "instanceof", "in", "of", "true", "false",
  "null", "undefined", "void", "yield", "static", "super", "interface", "type",
  "enum", "implements", "public", "private", "protected", "abstract", "readonly",
  "def", "print", "self", "None", "True", "False", "elif", "except", "lambda",
  "with", "as", "pass", "raise", "not", "and", "or", "is",
]);

const TOKEN_COLORS: Record<Token["type"], string> = {
  keyword:  "#165DFF",
  string:   "#00B42A",
  comment:  "#86909C",
  function: "#FF7D00",
  number:   "#F53F3F",
  plain:    "inherit",
};

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    // Single-line comment: // or #
    if ((line[i] === "/" && line[i + 1] === "/") || (line[i] === "#" && (i === 0 || line[i - 1] === " "))) {
      tokens.push({ type: "comment", value: line.slice(i) });
      break;
    }

    // String literals
    if (line[i] === '"' || line[i] === "'" || line[i] === "`") {
      const quote = line[i];
      let j = i + 1;
      while (j < line.length && line[j] !== quote) {
        if (line[j] === "\\") j++; // Skip escaped chars
        j++;
      }
      tokens.push({ type: "string", value: line.slice(i, j + 1) });
      i = j + 1;
      continue;
    }

    // Numbers (including decimals)
    if (/[0-9]/.test(line[i]) && (i === 0 || /[\s(=,+\-*/%[\]{}<>!&|^~;:]/.test(line[i - 1]))) {
      let j = i;
      while (j < line.length && /[0-9.xXa-fA-F_]/.test(line[j])) j++;
      tokens.push({ type: "number", value: line.slice(i, j) });
      i = j;
      continue;
    }

    // Words (identifiers / keywords / function names)
    if (/[a-zA-Z_$]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_$]/.test(line[j])) j++;
      const word = line.slice(i, j);

      // Check if followed by ( → function call
      const nextNonSpace = line.slice(j).match(/^\s*\(/);

      if (KEYWORDS.has(word)) {
        tokens.push({ type: "keyword", value: word });
      } else if (nextNonSpace) {
        tokens.push({ type: "function", value: word });
      } else {
        tokens.push({ type: "plain", value: word });
      }
      i = j;
      continue;
    }

    // Everything else (operators, whitespace, punctuation)
    tokens.push({ type: "plain", value: line[i] });
    i++;
  }

  return tokens;
}

/* ─── Code Block Component ─── */

export interface InterveCodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  maxHeight?: string;
  className?: string;
}

export function InterveCodeBlock({
  code,
  language = "text",
  showLineNumbers = true,
  maxHeight = "400px",
  className,
}: InterveCodeBlockProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const lines = code.split("\n");
  const shouldHighlight = language !== "text" && language !== "plaintext";

  return (
    <div
      className={cn(
        "relative rounded-[var(--radius-md)] overflow-hidden",
        "bg-[rgba(250,250,252,0.8)] backdrop-blur-[8px]",
        "border border-[rgba(0,0,0,0.05)]",
        "group",
        className
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[rgba(0,0,0,0.04)] bg-[rgba(250,250,252,0.5)]">
        <span className="text-[12px] font-medium text-[#86909C] uppercase tracking-wider">
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-sm)]",
            "text-[12px] font-medium",
            "transition-all duration-[var(--motion-fast)] ease-[var(--ease-primary)]",
            copied
              ? "bg-[var(--interve-success-surface)] text-[var(--interve-success-text)]"
              : "text-[#86909C] hover:bg-white hover:text-[var(--interve-text-body)]"
          )}
        >
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <div
        className="overflow-x-auto overflow-y-auto"
        style={{ maxHeight }}
      >
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-[rgba(0,0,0,0.02)] transition-colors duration-75">
                {showLineNumbers && (
                  <td className="px-4 py-0 text-right select-none w-[1%] whitespace-nowrap">
                    <span className="text-[12px] text-[#C9CDD4] tabular-nums">
                      {i + 1}
                    </span>
                  </td>
                )}
                <td className="px-4 py-0">
                  <pre className="text-[13px] font-mono text-[#1D2129] leading-[22px] whitespace-pre">
                    {shouldHighlight
                      ? tokenizeLine(line).map((token, j) => (
                          <span key={j} style={{ color: TOKEN_COLORS[token.type] }}>
                            {token.value}
                          </span>
                        ))
                      : (line || " ")
                    }
                    {line === "" && shouldHighlight && " "}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
