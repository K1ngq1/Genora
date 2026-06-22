# API Keys 说明

本文档汇总项目中使用的 API key 环境变量，供开发者参考配置。

## 环境变量清单

### AGNES_IMAGE_2_1_FLASH_API_KEY
- **用途**: Agnes Image 2.1 Flash 图片生成 API 认证密钥
- **类型**: Bearer Token
- **服务地址**: `https://apihub.agnes-ai.com/v1`
- **使用的模块**:
  - `lib/agnes.ts` — `generateAgnesImage()`
  - `app/api/images/generate/route.ts` — 默认模型
  - `app/api/agent/generate/route.ts` — 图像生成

### AGNES_1_5_FLASH_API_KEY
- **用途**: Agnes 2.0 Flash 文本/对话 API 认证密钥
- **命名说明**: 该环境变量沿用早期 1.5 Flash 命名，当前实际请求模型为 `agnes-2.0-flash`
- **类型**: Bearer Token
- **服务地址**: `https://apihub.agnes-ai.com/v1`
- **使用的模块**:
  - `lib/agnes.ts` — `generateAgnesText()`、`generateAgnesMessages()`
  - `app/api/text/generate/route.ts` — 文本节点生成
  - `app/api/agent/generate/route.ts` — Agent 对话

### AGNES_VIDEO_V2_0_API_KEY
- **用途**: Agnes Video V2.0 视频生成 API 认证密钥
- **类型**: Bearer Token
- **服务地址**: `https://apihub.agnes-ai.com/v1`
- **使用的模块**:
  - `app/api/videos/generate/route.ts`

### SUPABASE_SERVICE_ROLE_KEY
- **用途**: 服务端将 Agnes 输入图片上传到 Supabase Storage
- **类型**: Supabase service-role key，仅允许服务端读取
- **Bucket**: `SUPABASE_AGNES_BUCKET`，默认值为 `agnes-inputs`
- **配套变量**: `NEXT_PUBLIC_SUPABASE_URL`
- **初始化命令**: `npm run storage:setup`
- **注意**: 禁止添加 `NEXT_PUBLIC_` 前缀，禁止写入日志或提交仓库

## 安全提醒

- 密钥不应提交到代码仓库。
- `.env` 文件已在 `.gitignore` 中忽略。
- 生产部署请使用部署平台的环境变量配置方式。
