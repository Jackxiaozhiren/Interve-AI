# BACKEND_CHOICE — 定案：A) 独立 FastAPI 服务

- 决策时间：开工 10 分钟内（Phase 0 同步定案）
- 选择：**A) 独立 FastAPI 服务 `services/dsa-api/`（Uvicorn :8000，前后端 CORS）**
- 理由：
  1. `apps/dsa-web/lib/api.ts` 冻结 `API_BASE_URL` 默认 `http://localhost:8000`，独立服务零改动即联调；
  2. `POST /datasets` 为 multipart 上传，FastAPI `UploadFile` + Pydantic 校验最直接；
  3. 需提供 `openapi.json`（OpenAPI 3.1）与 `/docs`，FastAPI 原生支持；
  4. 根仓已有 Next 应用（`src/`），dsa-web 若走 BFF 会与根 `app/api/*` 混淆，且 `API_BASE_URL` 同源改造风险更高。
- 落点：
  - API 实现：`services/dsa-api/app/main.py`（内存存储 + CSV 解析，5MB 上限，MIME 双检）
  - 契约：`apps/dsa-web/openapi.json`（OpenAPI 3.1，12 端点）→ `GET /openapi.json` 与 `/docs` 由 FastAPI 原生提供
  - CORS 仅放行：`http://localhost:3000`、`http://localhost:3001`（dsa-web  dev 备用端口）
  - 前端：`NEXT_PUBLIC_API_BASE_URL` 覆盖保留，`lib/api.ts` 签名不改，仅加类型注解
