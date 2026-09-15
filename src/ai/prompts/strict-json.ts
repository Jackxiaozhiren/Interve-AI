// Shared strict-JSON suffix for structured-output prompts.
//
// Live-verified 2026-09-13 (free glm-4-flash via chat-completions): the model
// ignores `response_format: json_schema` and follows the prose instead of the
// injected schema — markdown fences, `result =` prefixes, trailing
// explanations, and prose-shaped key names (Situation vs s). The proven
// pattern (analyze-behavior, passing live) is prose that names the EXACT
// schema keys plus this suffix. Builders append it; routes add
// `experimental_repairText: repairZhipuJson` as second-layer defense.
export const STRICT_JSON_SUFFIX = `STRICT OUTPUT CONTRACT (must follow exactly):
- Respond with ONLY one raw JSON object. No markdown fences. No code blocks. No explanations before or after. No extra top-level keys. No \`name =\` prefixes.
- Use EXACTLY the key names and nesting required by the schema, with exact casing.`;
