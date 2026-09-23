# P2-08 REPORT — 2026 final 编号对版（纯标签卡，零逻辑改动）

> Skills：`security-review`（被动）＋ `coding-standards`（注释即契约）。
> RED（诚实口径）：PAIN_REGISTER_V9 §D 本表（旧号实锤）＋ V9 初版误信过期 Slack 频道名（自纠记录见下）。

## 正典（fetch 实测 `GenAI-LLM-Top10/2026/final` 文件名）

LLM01 PromptInjection / LLM02 SensitiveInformationDisclosure / LLM03 ExcessiveAgency /
LLM04 SupplyChain / LLM05 DataModelPoisoning / LLM06 UnboundedConsumption /
LLM07 Misinformation / LLM08 HiddenContextExposure（2026 新增）/
LLM09 VectorAndEmbeddingWeaknesses / LLM10 ImproperOutputHandling。

## 自纠

V9 初版 §1.7 误将过期 Slack 频道名当作 2026 final（实为 2025 系），已在本卡更正 V9 文件 4 处。
教训：taxonomy 以正典仓库文件名为准，二级转述（频道名/新闻稿句子）禁作编号依据——已写入 V9 §1.7。

## 改动（注释/文档 only，共 6 编辑）

- `src/components/interve-ui/chat/message-card.tsx:140`、`src/lib/message-text.ts:35`、`docs/SECURITY.md:9`：输出处理 LLM05→LLM10（无主旧文件，注释级，零逻辑风险）。
- `docs/audit/S_VERIFY_V8.md`：LLM03/06 合并行拆成 LLM03（agency）＋LLM06（unbounded）两行＋对版注（自家文件）。
- `docs/audit/PAIN_REGISTER_V9.md`：§B/§D/§F 按正典重写（自家文件）。
- V9 Master Prompt（仓外交付物）：§1.7/§2/§4/继任声明 4 处更正。

## 未动（待 owner，禁碰）

- `SECURITY_REPORT.md` H4.4 “LLM10 Unbounded Consumption”笔误（应为 LLM06；其 S1–S10 余部全对）。
- `orama-abuse.test.ts:1` 等 LLM09（向量）标签经对版确认**正确**，无需改（虚惊一场，已通知性记录）。
- 注明 2025 系的历史行文（TECH_RESEARCH/MASTER_AUDIT/PAIN_REGISTER V6） intentionally 保留。

## GREEN

- `grep LLM05` 输出处理语境零残留（仅剩 LLM05=投毒合法行＋本卡证据行）。
- `npm run test` → **369/369 passed**；lint/tsc 不受注释改动影响（沿用本 HEAD verify 全绿）。
- keyed：0。
