# 通用校园场馆预约与服务管理系统

毕业设计项目。网球馆为展示主线；羽毛球馆、游泳馆在模型与管理端存在，用户端暂未开放预约。

- 前端：Vue 3 + TypeScript + Vite（`frontend/`，尚未开始）
- 后端：Spring Boot + PostgreSQL + Flyway（`backend/`，尚未开始）
- 前后端物理分离，仅通过 `docs/12-api-contract.md` 中的 REST 接口通信

**从这里开始：** [`docs/README.md`](docs/README.md)（五分钟摘要、阅读顺序、文档权威范围）。

新对话窗口接手时的协议见 [`docs/14-repo-and-workflow.md`](docs/14-repo-and-workflow.md) 第 8 节，工作包见 [`docs/15-implementation-roadmap.md`](docs/15-implementation-roadmap.md)。

代码质量与审计流程（含各角色提示词）见 [`docs/16-quality-gates-and-audit.md`](docs/16-quality-gates-and-audit.md)；自动检查脚本在 `scripts/`：`node scripts/check-docs.mjs`（文档）、`node scripts/check-code.mjs`（代码门禁）。

`sys.old/` 是已废弃的旧代码，不纳入版本控制，也不应被阅读。
