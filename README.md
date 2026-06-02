# Agnes Studio

AI 图片与视频生成工作台，支持：

- 使用 `gpt-image-2` 生成图片
- 使用 `agnes-video-v2.0` 文生视频
- 上传图片或选择生成结果制作视频

## 启动

1. 复制 `.env.example` 为 `.env`。
2. 在 `.env` 中填写 `OPENAI_API_KEY` 和 `AGNES_API_KEY`。
3. 安装依赖并初始化数据库：

```powershell
npm.cmd install
npm.cmd run db:push
```

4. 启动开发服务器：

```powershell
npm.cmd run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 存储

- SQLite 数据库：`prisma/dev.db`
- 生成图片：`storage/images/`
- 生成视频：`storage/videos/`
- 上传素材：`storage/uploads/`

Agnes 图生视频会先尝试将本地图片编码为 data URL。如果远程接口拒绝该格式，界面会提示需要接入公网对象存储。
