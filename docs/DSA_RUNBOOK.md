# DSA Runbook — API triage (web `apps/dsa-web` + api `services/dsa-api`)

Base: `API=http://localhost:8000`. Every response (success **and** error)
carries `x-request-id` — always paste it when escalating.

## 1. 后端是否活着

```bash
curl -s -D - http://localhost:8000/health
# → 200 {"status":"ok"} + x-request-id
```

顶栏 pill 显示 `API down`：先确认 8000 进程与 CORS（默认放行
`http://localhost:3000`、`http://localhost:3001`；生产域名经环境变量
`DSA_ALLOWED_ORIGINS=https://a.example,https://b.example` 追加后重起）。

## 2. 状态码对照

| 码 | 含义 | 页面表现 | curl 复现 |
|---|---|---|---|
| 401 | 本 API 无鉴权，正常不应出现；出现即代表经过了某层代理/网关 | ErrorState + Retry | `curl -s -o /dev/null -w "%{http_code}\n" $API/health` 应为 200，若 401 请检查代理 |
| 413 | 上传超 5MB 上限 | 上传区红色错误 `Upload failed (413…)`，列表不受影响 | `python3 -c "open('/tmp/big.csv','w').write('a\n'+'1\n'*3000000)" && curl -s -o /dev/null -w "%{http_code}\n" -F "file=@/tmp/big.csv;type=text/csv" $API/datasets` → 413 `{"detail":"File exceeds 5MB…"}` |
| 422 | 校验失败：`query` 空/>500 字符、未知扩展名、MIME 双检不一致、CSV/JSON 解析失败 | 表单/上传区 ErrorState（HTML 已脱标签） | `curl -s -w "\n%{http_code}\n" -X POST $API/analysis -H 'Content-Type: application/json' -d '{"dataset":"sales_q3","query":"'"$(python3 -c "print('x'*501)")"'"}'` → 422；`curl -s -o /dev/null -w "%{http_code}\n" -F "file=@/tmp/x.pdf;type=text/csv" $API/datasets` → 422 |
| 404 | 未知 dataset/run id | ErrorState + Retry（从不白屏） | `curl -s -w "\n%{http_code}\n" $API/runs/nope` → 404 `{"detail":"…"}` |
| 429 | **当前未实现限流**，本码不会由 API 发出；若见到 429，来自上游（Vercel/网关），请查网关配额 | 按 ErrorState 处理并重试 | 网关侧排查，不在 API 日志找 |
| 500 | 未捕获异常（中间件兜底 `{detail:"Internal server error"}`） | 全站 ErrorState + Retry；顶栏 pill 不受影响（/health 独立） | `uvicorn` 日志 + 响应头 `x-request-id` 定位 |

## 3. 联调三板斧

```bash
# 契约：12 操作 == apps/dsa-web/openapi.json
curl -s $API/openapi.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(sum(len(v) for v in d['paths'].values()), 'ops')"
# 可视化文档
open http://localhost:8000/docs
# 一次冒烟：建 run 再读回
RID=$(curl -s -X POST $API/analysis -H 'Content-Type: application/json' -d '{"dataset":"sales_q3","query":"smoke"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['runId'])")
curl -s $API/analysis/$RID | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['id'], d['status'], len(d.get('evidence',[])), 'evidence')"
```

## 4. 常见坑

- `POST /datasets` 必须 `multipart/form-data`（页面直调 FormData）；发 JSON 会 422。
- `validation_rate`/`confidence` 允许 `>1`（百分比风格旧分支），前端已做 `≤1 ×100` 归一。
- API 为内存存储：重启丢数据（上传/新建 run），属设计如此，非 bug。
