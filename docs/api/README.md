# API 文档目录

本目录用于存放 Genora 的 API 文档、接口约定和第三方服务对接说明。

## 当前文档

- `apimart.md`：APIMart 图片/视频生成、上传、任务轮询与积分规则。
- `gpt-image2-image-to-image.md`：KIE API 的 GPT Image 2 图生图任务创建接口。
- `gpt-image2-text-to-image.md`：当前文件为空，待补全文生图接口文档。

## 使用规则

- 新增第三方 API 时，应记录服务商、基础 URL、鉴权方式、请求体、响应体、错误码和任务查询方式。
- 异步任务 API 必须同时记录创建任务和查询任务的接口，否则不能视为完整可接入文档。
- 文档中不要写入真实 API Key、访问令牌或数据库密码。
