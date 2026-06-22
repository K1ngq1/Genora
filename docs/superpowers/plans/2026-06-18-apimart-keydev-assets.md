# APIMart KeyDev 与画布资产持久化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让最低价 APIMart 图片/视频测试模型通过 `APIMART_KEY_DEV` 可真实生成，并让节点上传图片在刷新和重启后保持可用。

**Architecture:** APIMart 客户端按模型路由服务端 Key，并用模型专属 payload builder 适配官方接口。Prisma `Asset` 表保存项目资产元数据，文件内容继续写入服务端 `storage/uploads`；前端节点只保存 `/api/assets/{id}` 稳定 URL。

**Tech Stack:** Next.js 15、TypeScript、Prisma、SQLite、Node.js 检查脚本、APIMart REST API。

---

### Task 1: APIMart 失败诊断与 KeyDev 模型目录

**Files:**
- Modify: `lib/model-catalog.ts`
- Modify: `lib/apimart.ts`
- Modify: `lib/error-codes.ts`
- Test: `scripts/check-apimart-model-catalog.mjs`
- Test: `scripts/check-apimart-payloads.mjs`

- [ ] **Step 1: 写失败测试**

断言目录包含 `gpt-image-2-official` 与 `grok-imagine-1.5-video-apimart`，并断言两个模型使用 `dev` Key 路由及官方请求字段：

```js
assert.equal(getModelDefinition("gpt-image-2-official").keyScope, "dev");
assert.deepEqual(buildApimartVideoPayload(options), {
  model: "grok-imagine-1.5-video-apimart",
  prompt: options.prompt,
  size: "16:9",
  duration: 6,
  quality: "480p",
});
```

- [ ] **Step 2: 验证测试因缺少模型和映射失败**

Run: `node scripts/check-apimart-model-catalog.mjs && node scripts/check-apimart-payloads.mjs`
Expected: FAIL，指出模型不存在或 Grok payload 不匹配。

- [ ] **Step 3: 最小实现模型、定价、Key 路由和错误详情**

新增模型定义；`apiKey(service, model)` 对两个测试模型读取 `APIMART_KEY_DEV`，其余模型保持现有 Key。`request()` 将截断、去敏后的上游错误详情附加到 `AppError`。

- [ ] **Step 4: 验证针对性测试通过**

Run: `node scripts/check-apimart-model-catalog.mjs && node scripts/check-apimart-payloads.mjs`
Expected: PASS。

### Task 2: 资产数据库与稳定文件接口

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_assets/migration.sql`
- Create: `lib/assets.ts`
- Modify: `app/api/uploads/route.ts`
- Create: `app/api/assets/[id]/route.ts`
- Test: `scripts/check-persistent-assets.mjs`

- [ ] **Step 1: 写失败测试**

检查 Prisma `Asset` 关系、上传接口的 `projectId` 验证、稳定资产 URL 与文件读取路由：

```js
assert.match(schema, /model Asset/);
assert.match(uploadRoute, /projectId/);
assert.match(assetRoute, /db\.asset\.findUnique/);
```

- [ ] **Step 2: 验证测试失败**

Run: `node scripts/check-persistent-assets.mjs`
Expected: FAIL，指出 `Asset` 或资产路由不存在。

- [ ] **Step 3: 实现 Asset 表与路由**

`Asset` 保存 `projectId`、`path`、`originalName`、`mimeType`、`byteSize`、时间戳；上传成功返回：

```ts
return Response.json({
  id: asset.id,
  url: `/api/assets/${asset.id}`,
  name: asset.originalName,
  type: asset.mimeType,
});
```

- [ ] **Step 4: 执行本地 Prisma 迁移并验证测试**

Run: `npx prisma migrate dev --name add_assets`
Run: `node scripts/check-persistent-assets.mjs`
Expected: migration 与检查均成功。

### Task 3: 节点上传改为服务端资产

**Files:**
- Modify: `app/page.tsx`
- Test: `scripts/check-persistent-assets.mjs`

- [ ] **Step 1: 扩展失败测试**

断言图片素材、图片参考图和视频首尾帧通过 `uploadAsset`，并禁止 `URL.createObjectURL(file)` 进入节点持久数据。

- [ ] **Step 2: 验证新增断言失败**

Run: `node scripts/check-persistent-assets.mjs`
Expected: FAIL，指出页面仍使用 blob URL。

- [ ] **Step 3: 实现前端上传回调**

父画布提供捕获当前 `projectId` 的上传函数，`WorkflowNode` 在选择文件后等待 `/api/uploads` 返回稳定 URL，再更新 `url`、`startFrameUrl` 或 `endFrameUrl`。

- [ ] **Step 4: 验证节点持久化检查通过**

Run: `node scripts/check-persistent-assets.mjs`
Expected: PASS。

### Task 4: 真实 APIMart 测试脚本

**Files:**
- Create: `scripts/test-apimart-live.mjs`
- Modify: `package.json`
- Modify: `docs/api/apimart.md`

- [ ] **Step 1: 编写默认安全的测试脚本**

脚本必须要求 `APIMART_LIVE_TEST=1`，仅从服务端环境读取 `APIMART_KEY_DEV`，每个模型最多提交一次，并轮询统一任务接口直到完成或明确失败。

- [ ] **Step 2: 先运行保护模式**

Run: `node scripts/test-apimart-live.mjs`
Expected: 安全退出并提示未启用真实测试，零付费请求。

- [ ] **Step 3: 更新文档**

记录 KeyDev 模型、实际请求字段、资产上传链路和真实测试命令，不写入任何 Key。

### Task 5: 回归、真实生成与重启验证

**Files:**
- Modify: `docs/prd.md`
- Modify: `package.json`

- [ ] **Step 1: 运行全量静态检查**

Run: `npm run check`
Expected: 全部通过。

- [ ] **Step 2: 运行生产构建**

Run: `npm run build`
Expected: Prisma generate、TypeScript、Next.js build 全部通过。

- [ ] **Step 3: 各执行一次真实生成**

Run: `$env:APIMART_LIVE_TEST='1'; node --env-file=.env scripts/test-apimart-live.mjs`
Expected: 图片与视频任务各提交一次，最终 `completed`，输出 URL 被下载到本地测试目录；日志不包含 Key。

- [ ] **Step 4: 验证资产跨重启可用**

通过 `/api/uploads` 上传一张已授权测试图片，保存项目，重启开发服务器后请求 `/api/assets/{id}` 与项目 API；两者均返回 200，项目节点 URL 仍为资产 URL而非 `blob:`。

- [ ] **Step 5: 更新需求与完成审计**

将已确认 KeyDev 与资产持久化规则写入 `docs/prd.md`，核对每项用户需求均有运行时证据。
