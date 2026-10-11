# 通用校园场馆预约与服务管理系统

毕业设计项目。网球馆为展示主线；羽毛球馆、游泳馆在模型与管理端存在，用户端暂未开放预约。

- 前端：Vue 3 + TypeScript + Vite（`frontend/`）。四类表面（用户端、场馆管理员端、系统管理员端、运营大屏）已完成，在 `mock` 模式下可完整运行，不需要后端
- 后端：Spring Boot + PostgreSQL + Flyway（`backend/`，尚未开始）
- 前后端物理分离，仅通过 `docs/12-api-contract.md` 中的 REST 接口通信

**从这里开始：** [`docs/README.md`](docs/README.md)（五分钟摘要、阅读顺序、文档权威范围）。

新对话窗口接手时的协议见 [`docs/14-repo-and-workflow.md`](docs/14-repo-and-workflow.md) 第 8 节，工作包见 [`docs/15-implementation-roadmap.md`](docs/15-implementation-roadmap.md)。

代码质量与审计流程（含各角色提示词）见 [`docs/16-quality-gates-and-audit.md`](docs/16-quality-gates-and-audit.md)；自动检查脚本在 `scripts/`：`node scripts/check-docs.mjs`（文档）、`node scripts/check-code.mjs`（代码门禁）。

## 前端：本地运行

需要 Node.js 22.12 及以上的 22.x、24.x，或 26 及以上（不支持 23 和 25；见 `frontend/package.json` 的 `engines`），以及 pnpm。在 `frontend/` 目录下：

```bash
pnpm install
pnpm dev
```

`pnpm dev` 启动开发服务器，默认是 `mock` 模式（数据在浏览器内存里，刷新页面即恢复种子数据）。数据模式只由环境变量 `VITE_API_MODE`（`mock` 或 `http`）决定，页面代码不变；需要修改时把 `frontend/.env.example` 复制为 `.env.local`（不入库）。

提交前的四条门禁（都要通过）：

```bash
pnpm type-check
pnpm lint:check
pnpm test:unit:run
pnpm build
```

### 演示账号

演示账号的用户名、角色和授权场馆见 `docs/13-database-design.md` 第 5.3 节（`13` 第 5.3 节）。口令也写在那里，**只用于本地演示的 mock 数据**，不得用于任何真实环境。

### 各表面入口

| 路径 | 内容 | 谁可以进入 |
| --- | --- | --- |
| `/login` | 登录与注册 | 所有人 |
| `/`、`/reservation`、`/booking`、`/me` | 用户端四页：首页、预约、订场、我的（按 iPhone 16 竖屏设计） | `USER` |
| `/venue-admin` | 场馆管理员端：概览、预约管理、场地与开放规则、场地占用总览、公告、报修、操作记录 | `VENUE_ADMIN` |
| `/sys-admin` | 系统管理员端：场馆资料与开关、管理员与授权、用户、系统公告、全局统计、操作记录，以及场馆运营各页 | `SYS_ADMIN` |
| `/display` | 运营大屏：只读的聚合指标，固定深色，无需登录 | 所有人 |

登录后会按角色进入各自入口；访问不属于自己角色的路径会被路由守卫拦回。

`sys.old/` 是已废弃的旧代码，不纳入版本控制，也不应被阅读。
