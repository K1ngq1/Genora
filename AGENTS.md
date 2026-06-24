# Genora 项目协作规则

## 1. 项目背景

- 本项目是 Genora，一个基于 Next.js 的无限画布 AI 创作工作台。
- 核心能力：文本生图、文本生视频、图片/提示词生视频、Agent 对话辅助创作。
- 部署和数据服务优先接入 Supabase；如仍保留 SQLite/Prisma，修改前先确认当前技术栈。
- 开发前必须先阅读项目目录、代码风格、接口实现和已有文档。

## 2. 文档目录

所有项目文档统一放在 `docs/` 目录下：

- `docs/prd.md` — 已确认的产品需求、功能规格、业务规则
- `docs/api/` — API 文档、接口约定、第三方服务对接
- `docs/images/` — 截图、界面参考图、流程图

新增需求前，先确认是否已在 `docs/prd.md` 中记录。

## 3. 需求沉淀规则

- 讨论功能、需求、业务规则时，优先沉淀到 `docs/prd.md`。
- 只记录已明确确认的信息，未确认内容记为"待确认问题"。
- 涉及 API、模型、计费、部署和权限的需求，同时记录约束和风险。

## 4. Supabase 操作规则

- 执行 Supabase 任务时，优先使用 Supabase MCP 或 Genora MCP 工具。
- 涉及生产部署、数据库迁移、RLS 或公开访问权限时，需先向用户确认。
- MCP 不可用时明确说明，不要伪造执行结果。

## 5. 安全约定

- 不要把密钥、密码、API Key 写入前端代码、文档或提交到仓库。
- 前端只能使用 `NEXT_PUBLIC_` 开头的公开环境变量。
- 服务端密钥通过 `.env` 或部署平台配置。
- 不要在日志或错误提示中暴露完整密钥。

## Encoding Rules

- All source files must be read and written as UTF-8.
- Do not use shell redirection such as `echo ... > file`, `type > file`, or PowerShell `Out-File` to rewrite source files containing Chinese text.
- Do not use `Set-Content` without explicit `-Encoding utf8`.
- Prefer editing files through patch/edit tools.
- If scripts are needed, use Node.js `fs.readFileSync(path, "utf8")` and `fs.writeFileSync(path, content, "utf8")`.
- Never convert existing Chinese UI text to escaped, mojibake, ANSI, GBK, or garbled text.
- Before saving files with Chinese text, verify that Chinese characters remain readable.

## 7. 代码复用规则

1. 写新代码前，先搜索现有代码库中是否有相似逻辑。
2. 不要重复已有逻辑，直接复用或提取为共享模块。
3. 同一逻辑出现在两处以上时，重构为可复用函数/组件。
4. 共享代码放在 `lib/`、`scripts/` 等合适位置。
5. 不要创建大文件，按职责拆分。
6. 不要硬编码模型名、API 路径、状态值等，使用共享常量。
7. 修改现有行为时，保持公共 API、数据结构和 UI 行为不变，除非任务明确要求。
