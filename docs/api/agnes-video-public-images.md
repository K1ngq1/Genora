# Agnes Video 公网参考图接入

## 存储链路

1. 画布上传图片后，本地副本保存在 `storage/uploads`，节点保存 `/api/assets/{id}`。
2. 创建 Agnes 图生视频任务时，服务端读取受信任的本地文件并上传到 Supabase Storage 公共 Bucket。
3. 上传对象使用 `agnes/YYYY-MM-DD/{uuid}.{ext}` 路径，支持 JPEG、PNG 和 WebP，单文件上限 10 MB。
4. 服务端预检公共 URL，通过后才调用 Agnes Video API。

环境变量：

```env
NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY=""
SUPABASE_AGNES_BUCKET="agnes-inputs"
```

`SUPABASE_SERVICE_ROLE_KEY` 只能在服务端使用。执行 `npm run storage:setup` 可幂等创建或更新公共 Bucket。

## URL 预检

- 仅允许无认证信息的 HTTPS URL。
- 拒绝 localhost、本机地址、IPv4/IPv6 内网地址、保留地址和解析到这些地址的域名。
- 重定向逐跳校验，最多 3 次。
- 最终响应必须为 HTTP 200。
- Content-Type 必须为 `image/jpeg`、`image/png` 或 `image/webp`。
- 预检超时为 10 秒；失败时不提交 Agnes 任务。

## Agnes 请求映射

单图：

```json
{
  "image": "https://<project-ref>.supabase.co/storage/v1/object/public/agnes-inputs/..."
}
```

多图或包含尾帧：

```json
{
  "extra_body": {
    "image": ["<start-frame-url>", "<reference-url>", "<end-frame-url>"]
  }
}
```

图片按首帧、普通参考图、尾帧排序并去重。任务 `params` 保存公网 URL 和预检结果，不保存密钥。

## 超时恢复与日志

- 已获得上游 task ID 的任务超过本地轮询上限后保存为 `timeout`，保留 `remoteTaskId` 并设置 `canResume=true`。
- 继续查询接口将任务恢复为 `queued`，不会重新提交生成任务。
- 日志记录本地文件名、公网 URL、预检状态和最终 Agnes payload。
- Authorization、Bearer token、API key 和 service-role key 会统一脱敏。

真实存储验证不会调用 Agnes：

```powershell
$env:SUPABASE_STORAGE_LIVE_TEST="1"
npm run test:supabase-storage:live
```
