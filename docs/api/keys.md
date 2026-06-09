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

### HF_TOKEN (Hugging Face Token)
- **用途**: Hugging Face gated 模型访问权限（Ideogram 4 本地推理需要）
- **使用的模块**:
  - `lib/ideogram.ts`
  - `app/page.tsx`
- **注意**: 需先在 Hugging Face 接受模型协议

### IDEOGRAM_API_KEY / MAGIC_PROMPT_API_KEY
- **用途**: Ideogram Magic Prompt 扩写功能
- **使用的模块**:
  - `lib/ideogram.ts`
- **类型**: 二选一

## 安全提醒

- 密钥不应提交到代码仓库。
- `.env` 文件已在 `.gitignore` 中忽略。
- 生产部署请使用部署平台的环境变量配置方式。
