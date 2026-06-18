# APIMart 接入约定

## 服务与鉴权

- 基础地址：`https://api.apimart.ai/v1`
- 服务端使用 Bearer Token；图片读取 `APIMART_KEY_IMAGE`，视频和视频参考图上传读取 `APIMART_KEY_VIDEO`。
- 密钥不得写入前端、接口响应、日志或文档示例。

## 模型

| 类型 | 显示名称 | API 模型 ID | 画质 | 比例 | 时长 |
|---|---|---|---|---|---|
| 图片 | Gemini 2.5 Flash | `gemini-2.5-flash-image-preview` | 1K | 1:1、4:3、3:4、16:9、9:16 | - |
| 图片 | GPT Image 2 | `gpt-image-2` | 1K、2K、4K | 1:1、4:3、3:4、16:9、9:16 | - |
| 视频 | Seedance 2.0 | `doubao-seedance-2.0` | 480p、720p、1080p | 五种画布比例 | 4–15 秒 |
| 视频 | Kling v3 Omni | `kling-v3-omni` | 720p、1080p | 1:1、16:9、9:16 | 3–15 秒 |
| 视频 | HappyHorse 1.0 | `happyhorse-1.0` | 720p、1080p | 五种画布比例 | 3–15 秒 |

## 请求流程

1. 本地参考图通过 `POST /uploads/images` 上传，响应 URL 有效期为 72 小时。
2. 图片调用 `POST /images/generations`；视频调用 `POST /videos/generations`。
3. 创建接口返回 `task_id` 后，通过 `GET /tasks/{task_id}?language=zh` 轮询。
4. 完成后读取 `result.images` 或 `result.videos` 的第一个 URL，并立即下载到 Genora 本地存储。
5. `credits_cost` 记录为实际积分；创建任务前的积分仅为界面估算。

## 积分快照

定价快照日期：2026-06-18。图片按张计费；视频按画质和秒数计费。价格集中维护在 `lib/model-catalog.ts`，官网价格变化时只更新该目录和对应测试。

## 官方资料

- [任务查询](https://docs.apimart.ai/cn/api-reference/tasks/status)
- [图片上传](https://docs.apimart.ai/cn/api-reference/uploads/images)
- [GPT Image 2](https://docs.apimart.ai/cn/api-reference/images/gpt-image-2/generation)
- [Gemini 2.5 Flash](https://docs.apimart.ai/cn/api-reference/images/gemini-2.5-flash/generation)
- [Seedance 2.0](https://docs.apimart.ai/cn/api-reference/videos/doubao-seedance-2-0/generation)
- [Kling v3 Omni](https://docs.apimart.ai/cn/api-reference/videos/kling-v3-omni/generation)
- [HappyHorse 1.0](https://docs.apimart.ai/cn/api-reference/videos/happyhorse-1.0/generation)
