import type { AgentTool, IconName, Kind, MotionPreset, Quality, Ratio } from "./workspace-types";

export const RATIOS: Ratio[] = ["1:1", "4:3", "3:4", "16:9", "9:16"];
export const VIDEO_QUALITIES: Quality[] = ["480p", "720p", "1080p"];
export const VIDEO_FRAME_RATE = 24;
export const MAX_VIDEO_FRAMES = 441;
export const SAFE_VIDEO_MAX_FRAMES = 121;
export const SAFE_VIDEO_QUALITY: Quality = "1k";
export const TEMP_USER_NAME = "Genora";
export const MOTION_PRESETS: Array<{ id: MotionPreset; label: string; prompt: string }> = [
  { id: "auto", label: "自动镜头", prompt: "Use natural cinematic motion that best fits the scene." },
  { id: "push-in", label: "缓慢推进", prompt: "Camera slowly pushes in toward the subject." },
  { id: "pull-out", label: "缓慢拉远", prompt: "Camera slowly pulls back to reveal more of the scene." },
  { id: "pan-left", label: "向左横移", prompt: "Camera pans left smoothly while keeping the subject stable." },
  { id: "pan-right", label: "向右横移", prompt: "Camera pans right smoothly while keeping the subject stable." },
  { id: "tilt-up", label: "仰拍上移", prompt: "Camera tilts upward gently, adding vertical scene motion." },
  { id: "orbit-left", label: "左侧环绕", prompt: "Camera orbits slightly to the left around the subject." },
  { id: "orbit-right", label: "右侧环绕", prompt: "Camera orbits slightly to the right around the subject." },
  { id: "low-angle", label: "低机位", prompt: "Use a subtle low-angle cinematic perspective." },
  { id: "top-down", label: "俯视角", prompt: "Use a gentle top-down or high-angle camera perspective." },
];
export const ERROR_TEXT_ZH: Record<string, string> = {
  UNKNOWN_ERROR: "发生未知错误，请稍后重试。",
  INVALID_JSON_RESPONSE: "服务返回了非 JSON 内容，已阻止乱码直接显示。",
  MISSING_OPENAI_API_KEY: "尚未配置 OPENAI_API_KEY，请在 .env 中填写后重启服务。",
  MISSING_AGNES_API_KEY: "尚未配置 Agnes API Key，请在 .env 中配置对应服务的 Key 后重启。",
  MISSING_PUBLIC_IMAGE_STORAGE: "尚未配置 SUPABASE_SERVICE_ROLE_KEY，Agnes 无法读取本地上传图片。",
  PUBLIC_IMAGE_UPLOAD_FAILED: "图片上传到 Supabase Storage 失败，请检查 Bucket 和服务端配置。",
  INVALID_PUBLIC_IMAGE_URL: "上传后的图片地址不是安全的公网 HTTPS URL。",
  PUBLIC_IMAGE_PREFLIGHT_FAILED: "公网图片预检失败，Agnes 任务尚未提交。",
  MISSING_APIMART_IMAGE_KEY: "尚未配置 APIMART_KEY_IMAGE，请在 .env 中填写后重启服务。",
  MISSING_APIMART_VIDEO_KEY: "尚未配置 APIMART_KEY_VIDEO，请在 .env 中填写后重启服务。",
  MISSING_APIMART_DEV_KEY: "尚未配置 APIMART_KEY_DEV，请在 .env 中填写后重启服务。",
  APIMART_INSUFFICIENT_CREDITS: "APIMart 余额不足，请充值后重试。",
  APIMART_RATE_LIMIT: "APIMart 请求过于频繁，请稍后重试。",
  APIMART_UPSTREAM_ERROR: "APIMart 上游服务暂时不可用，请稍后重试。",
  APIMART_MISSING_TASK_ID: "APIMart 没有返回任务 ID。",
  APIMART_UPLOAD_FAILED: "参考图片上传到 APIMart 失败，请稍后重试。",
  APIMART_TASK_FAILED: "APIMart 生成任务失败。",
  APIMART_RESULT_MISSING: "APIMart 任务已完成，但没有返回结果地址。",
  UNSUPPORTED_MODEL_OPTIONS: "当前模型不支持所选比例、画质、时长或参考素材。",
  EMPTY_TEXT_PROMPT: "请输入文本提示词。",
  EMPTY_IMAGE_PROMPT: "请输入图片提示词。",
  EMPTY_VIDEO_PROMPT: "请输入视频提示词。",
  EMPTY_AGENT_PROMPT: "请输入 Agent 提示词。",
  UNSUPPORTED_AGENT_MODEL: "不支持的 Agent 模型。",
  INVALID_IMAGE_FORMAT: "图片仅支持 PNG、JPEG 或 WebP 格式。",
  IMAGE_UPLOAD_TOO_LARGE: "上传图片不能超过 10 MB。",
  IMAGE_TASK_NOT_FOUND: "找不到所选图片。",
  INTERRUPTED_BY_USER: "任务已被用户打断。",
  TASK_POLL_TIMEOUT: "任务状态查询超时，请稍后重新查询。",
  TIMEOUT: "已超时",
  TASK_NOT_FOUND: "任务不存在。",
  AGNES_LOCAL_IMAGE_UNSUPPORTED: "Agnes 暂时无法读取本地图片数据。当前本地 MVP 需要接入公网对象存储后再使用该图片。",
  AGNES_RATE_LIMIT: "Agnes 当前上游负载较高或请求过多，请稍后重试。",
  AGNES_SERVICE_BUSY: "Agnes 视频队列仍被远端任务占用，当前无法提交新任务。请等待远端 queued 任务结束，或更换/重置 Agnes API Key 后再试。",
  AGNES_REQUEST_TIMEOUT: "Agnes 视频接口长时间没有返回，通常是远端队列繁忙或任务卡在排队中。",
  AGNES_OUT_OF_MEMORY: "Agnes 上游显存不足，请使用 720p/1K、缩短时长，或稍后再试。",
  AGNES_CLOUDFLARE_520: "Agnes 上游网关异常 520。通常是上游服务或 Cloudflare 临时异常，不是本地参数错误。",
  AGNES_UPSTREAM_ERROR: "Agnes 上游服务请求失败。系统已自动重试，请稍后再试；如果持续失败，请降低画质或更换提示词。",
  AGNES_NO_DEPLOYMENT: "当前 Agnes 模型暂无可用部署，请检查模型名称或等待上游恢复。",
  AGNES_EMPTY_TEXT: "Agnes 2.0 Flash 没有返回文本内容。",
  AGNES_EMPTY_IMAGE: "Agnes Image 2.1 Flash 没有返回图片数据。",
  AGNES_MISSING_TASK_ID: "Agnes API 没有返回任务 ID。",
  AGNES_VIDEO_FAILED: "Agnes 视频生成失败。",
  AGNES_VIDEO_MISSING_URL: "Agnes 任务已完成，但没有返回视频地址。",
  DOWNLOAD_FAILED: "下载生成结果失败，请稍后重试。",
};

export const SUGGESTIONS = [
  "把画面氛围调冷一点，但保留柔和的光",
  "我想要一点孤独、安静、电影感的画面",
  "分析这个人物图适合生成什么视频动作",
  "把当前画布整理成一套镜头提示词",
  "给这张图做一个 5 秒循环视频创意",
  "让主体动作更克制、更高级",
  "设计三种不同风格的画面方案",
  "这个画面适合做成什么短视频故事",
  "生成一段适合 Agnes Video 的英文提示词",
  "把它改成产品广告片的镜头语言",
  "给我一个温暖、慢节奏的运镜方案",
  "提炼当前画布里的核心视觉关键词",
];

export const KIND_META: Record<Kind, { title: string; subtitle: string; icon: IconName }> = {
  text: { title: "文本", subtitle: "GPT-5.5", icon: "text" },
  image: { title: "图像", subtitle: "Agnes Image 2.1 Flash", icon: "image" },
  video: { title: "视频", subtitle: "Agnes Video V2.0", icon: "video" },
  storyboard: { title: "分镜表格", subtitle: "镜头结构", icon: "grid" },
  "media-image": { title: "图片素材", subtitle: "本地输入", icon: "image" },
  "media-video": { title: "视频素材", subtitle: "本地输入", icon: "video" },
  group: { title: "节点组", subtitle: "容器", icon: "grid" },
};

export const AGENT_TOOL_NAMES = new Set(["addNode", "updateNode", "removeNode", "generateNode", "addEdge"]);
export const AGENT_CANVAS_TOOLS: AgentTool[] = [
  { type: "function", function: { name: "addNode", description: "在画布上添加一个生成节点(text/image/video),可设置提示词和位置。", parameters: { type: "object", properties: { type: { type: "string", enum: ["text", "image", "video"], description: "节点类型" }, prompt: { type: "string", description: "生成提示词(可选)" }, position: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, description: "画布坐标(可选)" } }, required: ["type"] } } },
  { type: "function", function: { name: "updateNode", description: "修改指定节点的字段。", parameters: { type: "object", properties: { nodeId: { type: "string" }, patch: { type: "object", properties: { prompt: { type: "string" }, title: { type: "string" }, ratio: { type: "string", enum: ["1:1", "4:3", "3:4", "16:9", "9:16"] } } } }, required: ["nodeId", "patch"] } } },
  { type: "function", function: { name: "removeNode", description: "删除指定节点。", parameters: { type: "object", properties: { nodeId: { type: "string" } }, required: ["nodeId"] } } },
  { type: "function", function: { name: "generateNode", description: "触发指定节点的生成。", parameters: { type: "object", properties: { nodeId: { type: "string" } }, required: ["nodeId"] } } },
  { type: "function", function: { name: "addEdge", description: "连接两个节点,把 source 的输出作为 target 的输入。", parameters: { type: "object", properties: { sourceNodeId: { type: "string" }, targetNodeId: { type: "string" } }, required: ["sourceNodeId", "targetNodeId"] } } },
];
