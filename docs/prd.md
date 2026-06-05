# Genora PRD

## 项目概述

Genora 是一个无限画布式 AI 创作工作台，目标是在同一个画布中完成图像、视频、文本和 Agent 辅助创作。用户可以通过节点连接组织创作流程，并将上游节点内容作为下游生成提示词或素材来源。

## 已确认功能

- 无限画布：支持节点添加、拖拽、连接、缩放、网格和小地图入口。
- 节点类型：
  - 图像：文生图，当前目标模型为 Agnes Image 2.1 Flash。
  - 视频：文本生视频，以及图片 + 提示词生视频，目标模型为 Agnes Video V2.0。
  - 文本：用于提示词、文案和创意生成。
  - 图片/视频素材：用户上传的本地参考素材。
- 节点交互：
  - 从节点连接点拖出后，可以弹出添加节点菜单，并自动连接新节点。
  - 节点下方提示词面板在悬停或选中时出现。
  - 支持按 Delete / Backspace 删除选中节点。
  - 生成结果应直接展示在对应节点内。
- Agent：
  - 右下角以圆形入口打开 Genora Agent。
  - Agent 可以读取当前画布摘要、节点连接关系、对话历史和对话框中上传的图片/视频附件信息。
  - Agent 输入区上传的图片/视频仅作为对话附件预览，不直接添加到画布。
  - 小灯泡按钮用于生成或切换不同 prompt 灵感。
- 视觉风格：
  - 默认深色模式，整体为黑色背景 + 液态玻璃风格。
  - Genora 设置中提供深色模式、浅色模式、主题色和字体大小调整。

## API 与模型约定

- Agnes API Key 只允许放在服务端环境变量 `AGNES_API_KEY` 中。
- 图片生成：
  - 模型：`agnes-image-2.1-flash`。
  - 当前接口只向 Agnes 发送模型名和 prompt，避免传入不支持的 OpenAI 风格参数。
- 视频生成：
  - 模型：`agnes-video-v2.0`。
  - 默认帧率：24 FPS。
  - 总帧数按 Agnes Video V2.0 要求对齐为 `8n + 1`。
  - 总帧数上限：441 帧。
- `docs/api/` 中的 KIE/GPT Image 2 文档仅作为第三方 API 参考，不等同于当前 Agnes 接口。

## 待确认问题

- 是否正式从本地 SQLite/Prisma 迁移到 Supabase。
- Supabase 项目的表结构、RLS 策略和 Storage Bucket 命名。
- 是否部署到 Vercel、Supabase Edge Functions 或其他平台。
- 是否需要接入登录后用户 ID，并替换当前临时用户名 `Genora`。
- 是否保留 KIE/GPT Image 2 API 作为备用图片模型或只使用 Agnes Image 2.1 Flash。
