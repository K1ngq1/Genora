"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useViewport,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type OnConnectEnd,
} from "@xyflow/react";

type Kind = "text" | "image" | "video" | "media-image" | "media-video";
type Ratio = "1:1" | "4:3" | "3:4" | "16:9" | "9:16";
type Quality = "720p" | "1k" | "2k" | "4k";
type ImageModel = "agnes-image-2.1-flash" | "ideogram-4-nf4" | "ideogram-4-fp8";
type MotionPreset = "auto" | "push-in" | "pull-out" | "pan-left" | "pan-right" | "tilt-up" | "orbit-left" | "orbit-right" | "low-angle" | "top-down";
type ThemeTone = "dark" | "light";
type IconName =
  | "text"
  | "image"
  | "video"
  | "spark"
  | "plus"
  | "close"
  | "upload"
  | "history"
  | "send"
  | "map"
  | "grid"
  | "fit"
  | "settings"
  | "bulb"
  | "stop";

type WorkData = {
  kind: Kind;
  title: string;
  prompt: string;
  ratio: Ratio;
  quality: Quality;
  model?: ImageModel;
  motionPreset?: MotionPreset;
  duration: number;
  settingsOpen?: boolean;
  url?: string;
  startFrameUrl?: string;
  startFrameName?: string;
  endFrameUrl?: string;
  endFrameName?: string;
  result?: string;
  taskId?: string;
  busy?: boolean;
  error?: string;
  canResume?: boolean;
  update: (id: string, patch: Partial<WorkData>) => void;
  remove: (id: string) => void;
  generate: (id: string) => void;
};

type WorkNode = Node<WorkData, "work">;
type MenuState = { screen: { x: number; y: number }; flow: { x: number; y: number }; sourceId?: string };
type AgentMessage = { role: "user" | "assistant"; content: string; error?: boolean };
type AgentAttachment = { id: string; kind: "image" | "video"; name: string; url: string; dataUrl?: string };

const RATIOS: Ratio[] = ["1:1", "4:3", "3:4", "16:9", "9:16"];
const QUALITIES: Quality[] = ["720p", "1k", "2k", "4k"];
const LONG_EDGE: Record<Quality, number> = { "720p": 720, "1k": 1024, "2k": 2048, "4k": 3840 };
const VIDEO_FRAME_RATE = 24;
const MAX_VIDEO_FRAMES = 441;
const SAFE_VIDEO_MAX_FRAMES = 121;
const SAFE_VIDEO_QUALITY: Quality = "1k";
const TEMP_USER_NAME = "Genora";
const IMAGE_MODELS: Array<{ id: ImageModel; label: string; note: string }> = [
  { id: "agnes-image-2.1-flash", label: "Agnes Image 2.1 Flash", note: "API" },
  { id: "ideogram-4-nf4", label: "Ideogram 4 nf4", note: "CUDA" },
  { id: "ideogram-4-fp8", label: "Ideogram 4 fp8", note: "Local" },
];
const MOTION_PRESETS: Array<{ id: MotionPreset; label: string; prompt: string }> = [
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
const ERROR_TEXT_ZH: Record<string, string> = {
  UNKNOWN_ERROR: "发生未知错误，请稍后重试。",
  INVALID_JSON_RESPONSE: "服务返回了非 JSON 内容，已阻止乱码直接显示。",
  MISSING_OPENAI_API_KEY: "尚未配置 OPENAI_API_KEY，请在 .env 中填写后重启服务。",
  MISSING_AGNES_API_KEY: "尚未配置 AGNES_API_KEY，请在 .env 中填写后重启服务。",
  EMPTY_TEXT_PROMPT: "请输入文本提示词。",
  EMPTY_IMAGE_PROMPT: "请输入图片提示词。",
  EMPTY_VIDEO_PROMPT: "请输入视频提示词。",
  EMPTY_AGENT_PROMPT: "请输入 Agent 提示词。",
  UNSUPPORTED_AGENT_MODEL: "不支持的 Agent 模型。",
  INVALID_IMAGE_FORMAT: "图片仅支持 PNG、JPEG 或 WebP 格式。",
  IMAGE_UPLOAD_TOO_LARGE: "上传图片不能超过 10 MB。",
  IMAGE_TASK_NOT_FOUND: "找不到所选图片。",
  INTERRUPTED_BY_USER: "任务已被用户打断。",
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
  IDEOGRAM_MISSING_HF_TOKEN: "尚未配置 HF_TOKEN，无法下载 Ideogram 4 gated 权重。",
  IDEOGRAM_MODEL_ACCESS_DENIED: "无法访问 Ideogram 4 权重。请先在 Hugging Face 接受模型协议，并确认 HF_TOKEN 有权限。",
  IDEOGRAM_NOT_INSTALLED: "Ideogram 4 本地 Python 环境尚未安装。请先在 vendor/ideogram4 中执行 pip install -e .。",
  IDEOGRAM_NF4_REQUIRES_CUDA: "Ideogram 4 nf4 需要 CUDA 显卡环境。当前是 CPU 环境，请改用 Ideogram 4 fp8 或切换到 CUDA 版 Python/PyTorch。",
  IDEOGRAM_INFERENCE_FAILED: "Ideogram 4 本地推理失败，请检查 Python 环境、显存和模型权限。",
  IDEOGRAM_IMG2IMG_UNSUPPORTED: "Ideogram 4 开源推理仓库目前只提供文生图入口，暂不支持图生图。",
  DOWNLOAD_FAILED: "下载生成结果失败，请稍后重试。",
};

const SUGGESTIONS = [
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

const KIND_META: Record<Kind, { title: string; subtitle: string; icon: IconName }> = {
  text: { title: "文本", subtitle: "GPT-5.5", icon: "text" },
  image: { title: "图像", subtitle: "Agnes Image 2.1 Flash", icon: "image" },
  video: { title: "视频", subtitle: "Agnes Video V2.0", icon: "video" },
  "media-image": { title: "图片素材", subtitle: "本地输入", icon: "image" },
  "media-video": { title: "视频素材", subtitle: "本地输入", icon: "video" },
};

function imageModelLabel(model?: ImageModel) {
  return IMAGE_MODELS.find((item) => item.id === model)?.label ?? "Agnes Image 2.1 Flash";
}

function dimensions(ratio: Ratio, quality: Quality): [number, number] {
  const long = LONG_EDGE[quality];
  const sizes: Record<Ratio, [number, number]> = {
    "1:1": [long, long],
    "4:3": [long, long * 0.75],
    "3:4": [long * 0.75, long],
    "16:9": [long, (long * 9) / 16],
    "9:16": [(long * 9) / 16, long],
  };
  return sizes[ratio].map((value) => Math.max(16, Math.round(value / 16) * 16)) as [number, number];
}

function imageSize(ratio: Ratio, quality: Quality) {
  let [width, height] = dimensions(ratio, quality);
  const maxPixels = 8_294_400;
  if (width * height > maxPixels) {
    const scale = Math.sqrt(maxPixels / (width * height));
    width = Math.floor((width * scale) / 16) * 16;
    height = Math.floor((height * scale) / 16) * 16;
  }
  return `${width}x${height}`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function appendImageFromUrl(form: FormData, field: string, url: string, name: string, mode: "set" | "append" = "set") {
  const response = await fetch(url);
  if (!response.ok) throw new Error("DOWNLOAD_FAILED");
  const blob = await response.blob();
  const filename = name.replace(/[^\w.-]+/g, "-") || `${field}.png`;
  if (mode === "append") form.append(field, blob, filename);
  else form.set(field, blob, filename);
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("INVALID_JSON_RESPONSE");
  }
}

function localizeError(value: unknown) {
  const text = String(value ?? "UNKNOWN_ERROR");
  return ERROR_TEXT_ZH[text] ?? text;
}

function responseError(body: Record<string, unknown>, fallback = "UNKNOWN_ERROR") {
  return localizeError(body.errorCode ?? body.error ?? fallback);
}

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    text: <path d="M5 6V4h14v2M12 4v16m-4 0h8" />,
    image: (
      <>
        <rect width="18" height="16" x="3" y="4" rx="3" />
        <circle cx="8.5" cy="9" r="1.5" />
        <path d="m21 15-5-5L5 20" />
      </>
    ),
    video: (
      <>
        <rect width="14" height="12" x="3" y="6" rx="3" />
        <path d="m17 10 4-2v8l-4-2" />
      </>
    ),
    spark: <path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8Z" />,
    plus: <path d="M12 5v14m-7-7h14" />,
    close: <path d="M18 6 6 18M6 6l12 12" />,
    upload: (
      <>
        <path d="M12 16V4m0 0L8 8m4-4 4 4" />
        <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5M12 7v5l3 2" />
      </>
    ),
    send: <path d="m22 2-7 20-4-9-9-4Z" />,
    map: <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15" />,
    grid: (
      <>
        <path d="M4 4h16v16H4z" />
        <path d="M4 10h16M4 16h16M10 4v16M16 4v16" />
      </>
    ),
    fit: (
      <>
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3" />
      </>
    ),
    settings: (
      <>
        <path d="M4 7h10m4 0h2M4 17h2m4 0h10" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="8" cy="17" r="2" />
      </>
    ),
    bulb: (
      <>
        <path d="M9 18h6M10 22h4" />
        <path d="M8 14a6 6 0 1 1 8 0c-1.2.9-1.7 1.8-1.8 3H9.8c-.1-1.2-.6-2.1-1.8-3Z" />
      </>
    ),
    stop: <rect x="8" y="8" width="8" height="8" rx="1.5" />,
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function WorkflowNode({ id, data }: NodeProps<WorkNode>) {
  const picker = useRef<HTMLInputElement>(null);
  const startFramePicker = useRef<HTMLInputElement>(null);
  const endFramePicker = useRef<HTMLInputElement>(null);
  const meta = KIND_META[data.kind];
  const isMedia = data.kind.startsWith("media-");
  const promptHeight = Math.min(260, Math.max(96, 78 + data.prompt.length / 3 + data.prompt.split("\n").length * 20));
  const importMedia = (file?: File) => {
    if (!file) return;
    data.update(id, {
      kind: file.type.startsWith("video/") ? "media-video" : "media-image",
      title: file.name,
      url: URL.createObjectURL(file),
      result: undefined,
      error: "",
    });
  };
  const importFrame = (slot: "start" | "end", file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      data.update(id, { error: "首尾帧只能上传图片素材。" });
      return;
    }
    if (slot === "start") {
      data.update(id, { startFrameUrl: URL.createObjectURL(file), startFrameName: file.name, error: "" });
    } else {
      data.update(id, { endFrameUrl: URL.createObjectURL(file), endFrameName: file.name, error: "" });
    }
  };

  return (
    <article className={`canvas-node glass ${data.kind}`}>
      <Handle type="target" position={Position.Left} className="port left" />
      <button className="node-upload nodrag" onClick={() => picker.current?.click()}>
        <Icon name="upload" />
        上传
      </button>
      <div className="node-badge">
        <span>
          <Icon name={meta.icon} />
          {data.title}
        </span>
        <button aria-label="删除节点" onClick={() => data.remove(id)}>
          <Icon name="close" />
        </button>
      </div>
      <input ref={picker} hidden type="file" accept="image/*,video/*" onChange={(event) => importMedia(event.target.files?.[0])} />
      <div className="node-body">
        {data.url ? (
          data.kind.includes("video") ? (
            <video src={data.url} controls />
          ) : (
            <img src={data.url} alt={data.title} />
          )
        ) : data.error ? (
          <div className="node-error-card">
            <Icon name={meta.icon} />
            <span>生成失败</span>
            <p>{data.error}</p>
          </div>
        ) : data.result ? (
          <p className="text-result">{data.result}</p>
        ) : (
          <div className="node-blank">
            <Icon name={meta.icon} />
            <span>{isMedia ? "上传或拖入素材" : "等待生成"}</span>
          </div>
        )}
      </div>
      {!isMedia && (
        <div className="prompt-pop nodrag" onMouseDown={(event) => event.stopPropagation()}>
          {data.kind === "video" && (
            <div className="frame-strip">
              <span className="prompt-tool-square">
                <Icon name="spark" />
              </span>
              <span className="frame-divider" />
              <button type="button" className={`frame-chip ${data.startFrameUrl ? "filled" : ""}`} onClick={() => startFramePicker.current?.click()}>
                {data.startFrameUrl ? <img src={data.startFrameUrl} alt="首帧" /> : <Icon name="plus" />}
                <span>{data.startFrameUrl ? "首帧" : "首帧"}</span>
              </button>
              <span className="frame-link">⇄</span>
              <button type="button" className={`frame-chip ${data.endFrameUrl ? "filled" : ""}`} onClick={() => endFramePicker.current?.click()}>
                {data.endFrameUrl ? <img src={data.endFrameUrl} alt="尾帧" /> : <Icon name="plus" />}
                <span>{data.endFrameUrl ? "尾帧" : "尾帧"}</span>
              </button>
              <input ref={startFramePicker} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => importFrame("start", event.target.files?.[0])} />
              <input ref={endFramePicker} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => importFrame("end", event.target.files?.[0])} />
            </div>
          )}
          <textarea
            className="prompt-input"
            style={{ height: `${promptHeight}px` }}
            value={data.prompt}
            onChange={(event) => data.update(id, { prompt: event.target.value })}
            placeholder="填写提示词，描述你想生成的内容..."
          />
          <div className="prompt-toolbar">
            {(data.kind === "image" || data.kind === "video") && (
              <div className={`settings-details ${data.settingsOpen ? "open" : ""}`}>
                <button type="button" className="settings-trigger" onClick={(event) => { event.stopPropagation(); data.update(id, { settingsOpen: !data.settingsOpen }); }}>
                  <i className={`ratio-shape ratio-${data.ratio.replace(":", "-")}`} />
                  {data.ratio} · {data.quality.toUpperCase()}
                </button>
                {data.settingsOpen && (
                  <div className="node-options">
                    <div className="option-block">
                      <span>画质</span>
                      <div className="quality-options">
                        {QUALITIES.map((quality) => (
                          <button key={quality} className={data.quality === quality ? "selected" : ""} onClick={(event) => { event.stopPropagation(); data.update(id, { quality }); }}>
                            {quality.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    {data.kind === "image" && (
                      <div className="option-block">
                        <span>模型</span>
                        <div className="model-options">
                          {IMAGE_MODELS.map((model) => (
                            <button
                              key={model.id}
                              className={(data.model ?? "agnes-image-2.1-flash") === model.id ? "selected" : ""}
                              onClick={(event) => {
                                event.stopPropagation();
                                data.update(id, { model: model.id });
                              }}
                            >
                              <b>{model.label}</b>
                              <small>{model.note}</small>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="option-block">
                      <span>比例</span>
                      <div className="ratio-options">
                        {RATIOS.map((ratio) => (
                          <button key={ratio} className={data.ratio === ratio ? "selected" : ""} onClick={(event) => { event.stopPropagation(); data.update(id, { ratio }); }}>
                            <i className={`ratio-shape ratio-${ratio.replace(":", "-")}`} />
                            <em>{ratio}</em>
                          </button>
                        ))}
                      </div>
                    </div>
                    {data.kind === "video" && (
                      <div className="option-block duration-block">
                        <span>生成时长 <b>{data.duration} 秒 · 24 FPS</b></span>
                        <input type="range" min="1" max="18" step="1" value={data.duration} onChange={(event) => data.update(id, { duration: Number(event.target.value) })} />
                        <div><small>1 秒</small><small>≤ 441 帧</small><small>18 秒</small></div>
                      </div>
                    )}
                    {data.kind === "video" && (
                      <div className="option-block">
                        <span>????</span>
                        <div className="motion-options">
                          {MOTION_PRESETS.map((motion) => (
                            <button
                              key={motion.id}
                              className={(data.motionPreset ?? "auto") === motion.id ? "selected" : ""}
                              onClick={(event) => {
                                event.stopPropagation();
                                data.update(id, { motionPreset: motion.id });
                              }}
                            >
                              {motion.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {data.kind === "video" && <span>{data.duration} 秒 · 24 FPS</span>}
            <button className="generate-button" aria-label={data.busy ? "????" : "??"} title={data.busy ? "????" : "??"} onClick={() => data.generate(id)}>
              <Icon name={data.busy ? "stop" : "spark"} />
            </button>
          </div>
        </div>
      )}
      <Handle type="source" position={Position.Right} className="port right" />
    </article>
  );
}

const nodeTypes = { work: WorkflowNode };

function WorkflowCanvas() {
  const reactFlow = useReactFlow();
  const { zoom } = useViewport();
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [menu, setMenu] = useState<MenuState>();
  const [config, setConfig] = useState({ openaiConfigured: true, agnesConfigured: true });
  const [agentOpen, setAgentOpen] = useState(false);
  const [orbOpen, setOrbOpen] = useState(false);
  const [miniMapOpen, setMiniMapOpen] = useState(false);
  const [gridVisible, setGridVisible] = useState(true);
  const [themeTone, setThemeTone] = useState<ThemeTone>("dark");
  const [accentColor, setAccentColor] = useState("#a996ff");
  const [fontScale, setFontScale] = useState(100);
  const [agentInput, setAgentInput] = useState("");
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [agentAttachments, setAgentAttachments] = useState<AgentAttachment[]>([]);
  const [suggestionOffset, setSuggestionOffset] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const agentHasConversation = agentMessages.length > 0 || agentBusy;
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const configRef = useRef(config);
  const interruptedRef = useRef(new Set<string>());
  const messagesRef = useRef(agentMessages);
  const attachmentsRef = useRef(agentAttachments);
  const imagePicker = useRef<HTMLInputElement>(null);
  const videoPicker = useRef<HTMLInputElement>(null);
  const agentImagePicker = useRef<HTMLInputElement>(null);
  const agentVideoPicker = useRef<HTMLInputElement>(null);
  const visibleSuggestions = useMemo(() => [0, 1, 2].map((index) => SUGGESTIONS[(suggestionOffset + index) % SUGGESTIONS.length]), [suggestionOffset]);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { messagesRef.current = agentMessages; }, [agentMessages]);
  useEffect(() => { attachmentsRef.current = agentAttachments; }, [agentAttachments]);
  useEffect(() => { fetch("/api/config").then((response) => response.json()).then(setConfig).catch(() => undefined); }, []);
  useEffect(() => {
    if (agentOpen) setSuggestionOffset(Math.floor(Math.random() * SUGGESTIONS.length));
  }, [agentOpen]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) return;
      if (!selectedIds.length) return;
      event.preventDefault();
      setNodes((current) => current.filter((node) => !selectedIds.includes(node.id)));
      setEdges((current) => current.filter((edge) => !selectedIds.includes(edge.source) && !selectedIds.includes(edge.target)));
      setSelectedIds([]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIds, setEdges, setNodes]);

  const update = useCallback((id: string, patch: Partial<WorkData>) => setNodes((current) => current.map((node) => node.id === id ? { ...node, data: { ...node.data, ...patch } } : node)), [setNodes]);
  const remove = useCallback((id: string) => {
    setNodes((current) => current.filter((node) => node.id !== id));
    setEdges((current) => current.filter((edge) => edge.source !== id && edge.target !== id));
  }, [setEdges, setNodes]);
  const setCanvasZoom = useCallback((value: number) => reactFlow.zoomTo(Math.min(2, Math.max(0.25, value)), { duration: 160 }), [reactFlow]);
  const canvasSummary = useCallback(() => {
    const list = nodesRef.current.map((node, index) => {
      const kind = KIND_META[node.data.kind]?.title ?? node.data.kind;
      const parts = [
        node.data.prompt ? `提示词：${node.data.prompt}` : "",
        node.data.result ? `结果：${node.data.result}` : "",
        node.data.url ? `素材/结果：${node.data.title}` : "",
        node.data.error ? `错误：${node.data.error}` : "",
      ].filter(Boolean).join("；");
      return `${index + 1}. ${kind}节点「${node.data.title}」：${parts || "暂无内容"}`;
    });
    const edgeList = edgesRef.current.map((edge, index) => `${index + 1}. ${edge.source} -> ${edge.target}`);
    return `${list.length ? list.join("\n") : "画布当前没有节点。"}\n\n连接关系：\n${edgeList.length ? edgeList.join("\n") : "暂无连接。"}`;
  }, []);

  const pollTask = useCallback((nodeId: string, taskId: string, attempt = 0) => {
    window.setTimeout(async () => {
      if (interruptedRef.current.has(nodeId)) return;
      try {
        const response = await fetch(`/api/tasks/${taskId}`);
        const task = await readJson(response);
        if (!response.ok) throw new Error(responseError(task, "TASK_NOT_FOUND"));
        if (interruptedRef.current.has(nodeId)) return;
        if ((task.status === "completed" || task.status === "succeeded") && task.outputUrl) {
          update(nodeId, { busy: false, url: task.outputUrl, result: undefined, error: "" });
          return;
        }
        if (task.status === "failed") {
          update(nodeId, { busy: false, error: localizeError(task.errorCode ?? task.error ?? "AGNES_VIDEO_FAILED") });
          return;
        }
        if (attempt < 720) {
          update(nodeId, { busy: true, result: "视频生成中，正在等待 Agnes 回传..." });
          pollTask(nodeId, taskId, attempt + 1);
        } else {
          update(nodeId, { busy: false, error: "Agnes 仍在后台处理中，请稍后刷新任务继续同步。" });
        }
      } catch (error) {
        update(nodeId, { busy: false, error: error instanceof Error ? localizeError(error.message) : "查询视频任务失败" });
      }
    }, 2500);
  }, [update]);

  const generate = useCallback(async (id: string) => {
    const node = nodesRef.current.find((item) => item.id === id);
    if (!node) return;
    if (node.data.busy) {
      interruptedRef.current.add(id);
      update(id, { busy: false, result: "已打断生成同步，远端任务可能仍在后台继续。", error: "" });
      return;
    }
    interruptedRef.current.delete(id);
    const upstream = edgesRef.current
      .filter((edge) => edge.target === id)
      .map((edge) => nodesRef.current.find((item) => item.id === edge.source))
      .filter((item): item is WorkNode => Boolean(item));
    const prompt = [upstream.map((item) => item.data.result || item.data.prompt).filter(Boolean).join("\n\n"), node.data.prompt].filter(Boolean).join("\n\n");
    if (!prompt.trim()) return update(id, { error: "请填写提示词，或连接包含内容的上游节点。" });
    if (node.data.kind === "text" && !configRef.current.agnesConfigured) return update(id, { error: "请先在 .env 中配置 AGNES_API_KEY。" });
    if ((node.data.kind === "image" || node.data.kind === "video") && !configRef.current.agnesConfigured) return update(id, { error: "请先在 .env 中配置 AGNES_API_KEY。" });

    update(id, { busy: true, error: "", result: node.data.kind === "video" ? "视频任务提交中..." : undefined });
    try {
      let response: Response;
      if (node.data.kind === "text") {
        response = await fetch("/api/text/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      } else if (node.data.kind === "image") {
        const source = upstream.find((item) => item.data.url && !item.data.kind.includes("video"));
        const model = node.data.model ?? "agnes-image-2.1-flash";
        if (source?.data.url && model.startsWith("ideogram-4")) {
          throw new Error("IDEOGRAM_IMG2IMG_UNSUPPORTED");
        }
        response = await fetch("/api/images/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            size: imageSize(node.data.ratio, node.data.quality),
            quality: node.data.quality,
            model,
          }),
        });
      } else {
        const requestedQuality = node.data.quality;
        const requestedFrames = Math.min(MAX_VIDEO_FRAMES, Math.max(25, Math.round((node.data.duration * VIDEO_FRAME_RATE - 1) / 8) * 8 + 1));
        const safeQuality = requestedQuality === "720p" ? requestedQuality : SAFE_VIDEO_QUALITY;
        const safeFrames = Math.min(SAFE_VIDEO_MAX_FRAMES, requestedFrames);
        const [width, height] = dimensions(node.data.ratio, safeQuality);
        if (requestedQuality !== safeQuality || requestedFrames !== safeFrames) {
          update(id, {
            result: `已按稳定生成策略提交：${safeQuality.toUpperCase()} · ${safeFrames} 帧。高画质或长时长容易触发 Agnes 上游显存不足。`,
          });
        }
        const form = new FormData();
        form.set("prompt", prompt);
        form.set("width", String(width));
        form.set("height", String(height));
        form.set("numFrames", String(safeFrames));
        form.set("frameRate", String(VIDEO_FRAME_RATE));
        const motion = MOTION_PRESETS.find((item) => item.id === (node.data.motionPreset ?? "auto"));
        if (motion) {
          form.set("motionPreset", motion.id);
          form.set("motionPrompt", motion.prompt);
        }
        const imageSources = upstream.filter((item) => item.data.url && !item.data.kind.includes("video"));
        if (node.data.startFrameUrl) {
          await appendImageFromUrl(form, "referenceImage", node.data.startFrameUrl, node.data.startFrameName ?? "reference-start.png", "append");
        }
        if (node.data.endFrameUrl) {
          await appendImageFromUrl(form, "referenceImage", node.data.endFrameUrl, node.data.endFrameName ?? "reference-end.png", "append");
        }
        for (const [index, source] of imageSources.entries()) {
          if (source.data.url) {
            await appendImageFromUrl(form, "referenceImage", String(source.data.url), source.data.title || `connected-reference-${index + 1}.png`, "append");
          }
        }
        response = await fetch("/api/videos/generate", { method: "POST", body: form });
      }
      const body = await readJson(response);
      if (!response.ok) throw new Error(responseError(body, "UNKNOWN_ERROR"));
      if (node.data.kind === "video") {
        update(id, { busy: true, taskId: body.id, result: "视频生成中，正在等待 Agnes 回传..." });
        pollTask(id, body.id);
      } else {
        update(id, { busy: false, result: body.text, url: body.outputUrl, error: "" });
      }
    } catch (error) {
      update(id, { busy: false, error: error instanceof Error ? localizeError(error.message) : "生成失败" });
    }
  }, [pollTask, update]);

  const addNode = useCallback((kind: Kind, position?: { x: number; y: number }, file?: File, sourceId?: string) => {
    const point = position ?? reactFlow.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const id = crypto.randomUUID();
    setNodes((current) => [...current, {
      id,
      type: "work",
      position: { x: point.x - 140, y: point.y - 70 },
      data: {
        kind,
        title: file?.name ?? KIND_META[kind].title,
        prompt: "",
        ratio: "1:1",
        quality: kind === "video" ? SAFE_VIDEO_QUALITY : "2k",
        model: kind === "image" ? "agnes-image-2.1-flash" : undefined,
        motionPreset: kind === "video" ? "auto" : undefined,
        duration: 5,
        url: file ? URL.createObjectURL(file) : undefined,
        update,
        remove,
        generate,
      },
    }]);
    if (sourceId) setEdges((current) => addEdge({ id: `${sourceId}-${id}`, source: sourceId, target: id, animated: true }, current));
    setMenu(undefined);
  }, [generate, reactFlow, remove, setEdges, setNodes, update]);

  const openMenu = useCallback((x: number, y: number, sourceId?: string) => setMenu({ screen: { x, y }, flow: reactFlow.screenToFlowPosition({ x, y }), sourceId }), [reactFlow]);
  const onConnect = useCallback((connection: Connection) => setEdges((current) => addEdge({ ...connection, animated: true }, current)), [setEdges]);
  const onConnectEnd = useCallback<OnConnectEnd>((event, state) => {
    if (state.isValid || !state.fromNode) return;
    const pointer = "changedTouches" in event ? event.changedTouches[0] : event;
    setTimeout(() => openMenu(pointer.clientX, pointer.clientY, state.fromNode?.id), 0);
  }, [openMenu]);
  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) return;
    const position = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    if (file.type.startsWith("image/")) addNode("media-image", position, file);
    if (file.type.startsWith("video/")) addNode("media-video", position, file);
  }, [addNode, reactFlow]);
  const onWheel = useCallback((event: React.WheelEvent) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    setCanvasZoom(reactFlow.getZoom() * factor);
  }, [reactFlow, setCanvasZoom]);
  const focusNode = useCallback((event: React.MouseEvent, node: WorkNode) => {
    const target = event.target as HTMLElement;
    if (target.closest(".nodrag, button, textarea, input, video, a")) return;
    reactFlow.fitView({
      nodes: [{ id: node.id }],
      duration: 360,
      padding: 0.58,
      maxZoom: 1.12,
    });
  }, [reactFlow]);

  const sendAgent = useCallback(async () => {
    const content = agentInput.trim();
    if (!content || agentBusy) return;
    if (!configRef.current.agnesConfigured) {
      setAgentMessages((current) => [...current, { role: "assistant", content: "请先在 .env 中配置 AGNES_API_KEY。", error: true }]);
      return;
    }

    const attachments = attachmentsRef.current;
    const nextMessages: AgentMessage[] = [...messagesRef.current, { role: "user", content }];
    setAgentMessages(nextMessages);
    setAgentInput("");
    setAgentBusy(true);

    try {
      const history = nextMessages.map((message) => `${message.role === "user" ? "用户" : "Genora Agent"}：${message.content}`).join("\n");
      const attachmentText = attachments.length
        ? attachments.map((item, index) => `${index + 1}. ${item.kind === "image" ? "图片" : "视频"}附件：${item.name}`).join("\n")
        : "无";
      const textPart = [
        "你是 Genora Agent。请读取当前画布摘要、对话附件和历史上下文，回答最后一个用户问题。",
        "",
        "【画布内容】",
        canvasSummary(),
        "",
        "【对话附件】",
        attachmentText,
        "",
        "【上下文】",
        history,
      ].join("\n");
      const imageParts = attachments
        .filter((item) => item.kind === "image" && item.dataUrl)
        .map((item) => ({ type: "image_url", image_url: { url: item.dataUrl } }));
      const response = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "agnes-2.0-flash",
          prompt: textPart,
          messages: [{ role: "user", content: [{ type: "text", text: textPart }, ...imageParts] }],
        }),
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(responseError(body, "UNKNOWN_ERROR"));
      setAgentMessages((current) => [...current, { role: "assistant", content: body.text ?? "我已经收到。" }]);
    } catch (error) {
      setAgentMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? localizeError(error.message) : "Agent 调用失败", error: true }]);
    } finally {
      setAgentBusy(false);
    }
  }, [agentBusy, agentInput, canvasSummary]);

  const resetAgent = useCallback(() => {
    setAgentInput("");
    setAgentMessages([]);
    setAgentAttachments([]);
  }, []);
  const useSuggestion = useCallback((text: string) => setAgentInput(text), []);
  const inspire = useCallback(() => {
    const next = Math.floor(Math.random() * SUGGESTIONS.length);
    setSuggestionOffset(next);
    setAgentInput(SUGGESTIONS[next]);
  }, []);
  const importAgentMedia = useCallback(async (file: File | undefined, kind: "image" | "video") => {
    if (!file) return;
    const attachment: AgentAttachment = {
      id: crypto.randomUUID(),
      kind,
      name: file.name,
      url: URL.createObjectURL(file),
      dataUrl: kind === "image" ? await fileToDataUrl(file) : undefined,
    };
    setAgentAttachments((current) => [...current, attachment]);
  }, []);

  return (
    <main className={`canvas-shell ${agentOpen ? "agent-open" : ""} theme-${themeTone}`} style={{ "--accent": accentColor, "--font-scale": `${fontScale / 100}` } as React.CSSProperties}>
      <header className={`topbar ${agentOpen ? "agent-open" : ""}`}>
        <div className="brand"><img src="/assets/genora-logo.png" alt="" /><b>Genora</b><em>∞</em></div>
        <div className="top-title"><i className="status-dot" /><span>Untitled Space</span><small>已自动保存</small></div>
        <div className="top-actions"><button className="glass-pill"><Icon name="history" />作品库</button></div>
      </header>

      <input ref={imagePicker} hidden type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && addNode("media-image", undefined, event.target.files[0])} />
      <input ref={videoPicker} hidden type="file" accept="video/*" onChange={(event) => event.target.files?.[0] && addNode("media-video", undefined, event.target.files[0])} />
      <input ref={agentImagePicker} hidden type="file" accept="image/*" onChange={(event) => importAgentMedia(event.target.files?.[0], "image")} />
      <input ref={agentVideoPicker} hidden type="file" accept="video/*" onChange={(event) => importAgentMedia(event.target.files?.[0], "video")} />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={(changes) => {
          onNodesChange(changes);
          setSelectedIds((current) => {
            const next = new Set(current);
            changes.forEach((change) => {
              if (change.type === "select") change.selected ? next.add(change.id) : next.delete(change.id);
            });
            return [...next];
          });
        }}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onDrop={onDrop}
        onWheel={onWheel}
        onNodeClick={focusNode}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
        onDoubleClick={(event) => { if (!(event.target as HTMLElement).closest(".react-flow__node")) openMenu(event.clientX, event.clientY); }}
        onPaneClick={() => setMenu(undefined)}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        fitView
        fitViewOptions={{ maxZoom: 1 }}
        minZoom={0.25}
        maxZoom={2}
        colorMode="dark"
        defaultEdgeOptions={{ animated: true }}
        proOptions={{ hideAttribution: true }}
      >
        {gridVisible && <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#ffffff24" />}
        {miniMapOpen && <MiniMap position="bottom-right" pannable zoomable nodeColor="#8f7df5" maskColor="#050507a8" />}
        <Panel position="top-left" className="sidebar glass">
          <button className="sidebar-add" title="添加节点" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); openMenu(rect.right + 24, rect.top + 18); }}><Icon name="plus" /></button>
          <button title="文本" onClick={() => addNode("text")}><Icon name="text" /></button>
          <button title="图像" onClick={() => addNode("image")}><Icon name="image" /></button>
          <button title="视频" onClick={() => addNode("video")}><Icon name="video" /></button>
        </Panel>
        {nodes.length === 0 && <Panel position="top-center" className="empty-canvas"><Icon name="plus" /><b>双击画布开始创作</b><span>添加文字、图片或视频生成节点</span></Panel>}
      </ReactFlow>

      {menu && (
        <div className="node-menu glass" style={{ left: menu.screen.x, top: menu.screen.y }}>
          <header><b>{menu.sourceId ? "连接到新节点" : "添加节点"}</b><button onClick={() => setMenu(undefined)}><Icon name="close" /></button></header>
          <button onClick={() => addNode("image", menu.flow, undefined, menu.sourceId)}><Icon name="image" /><span><b>图像</b><em>Agnes Image 2.1 Flash</em></span><Icon name="plus" /></button>
          <button onClick={() => addNode("video", menu.flow, undefined, menu.sourceId)}><Icon name="video" /><span><b>视频</b><em>文本或图片 + 提示词</em></span><Icon name="plus" /></button>
          <button onClick={() => addNode("text", menu.flow, undefined, menu.sourceId)}><Icon name="text" /><span><b>文本</b><em>GPT-5.5</em></span><Icon name="plus" /></button>
          <hr />
          <button onClick={() => imagePicker.current?.click()}><Icon name="upload" /><span><b>上传图片</b><em>添加本地素材</em></span></button>
          <button onClick={() => videoPicker.current?.click()}><Icon name="upload" /><span><b>上传视频</b><em>添加参考素材</em></span></button>
        </div>
      )}

      <div className="canvas-control-bar glass">
        <button title="小地图" className={miniMapOpen ? "selected" : ""} onClick={() => setMiniMapOpen((current) => !current)}><Icon name="map" /></button>
        <button title="网格提示" className={gridVisible ? "selected" : ""} onClick={() => setGridVisible((current) => !current)}><Icon name="grid" /></button>
        <button title="适配画布" onClick={() => reactFlow.fitView({ duration: 220, maxZoom: 1 })}><Icon name="fit" /></button>
        <input aria-label="缩放画布" type="range" min="25" max="200" value={Math.round(zoom * 100)} onChange={(event) => setCanvasZoom(Number(event.target.value) / 100)} />
        <button title="画布设置" className={orbOpen ? "selected" : ""} onClick={() => setOrbOpen((current) => !current)}><Icon name="settings" /></button>
      </div>

      {orbOpen && (
        <div className="orb-popover glass">
          <b>Genora 设置</b>
          <span>调整画布视觉风格</span>
          <label>主题色 <input type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} /></label>
          <label>字体大小 <input type="range" min="90" max="115" value={fontScale} onChange={(event) => setFontScale(Number(event.target.value))} /></label>
          <div className="theme-options"><button className={themeTone === "dark" ? "selected" : ""} onClick={() => setThemeTone("dark")}>深色模式</button><button className={themeTone === "light" ? "selected" : ""} onClick={() => setThemeTone("light")}>浅色模式</button></div>
          <small>缩放：Ctrl + 鼠标滚轮</small>
        </div>
      )}

      <button className="agent-fab" aria-label="打开 Genora Agent" onClick={() => setAgentOpen((current) => !current)}><img src="/assets/genora-logo.png" alt="" /></button>
      {agentOpen && (
        <aside className={`agent-panel ${agentHasConversation ? "chatting" : ""}`}>
          <header><button aria-label="新建对话" onClick={resetAgent}><Icon name="plus" /></button><button aria-label="换一组灵感" onClick={inspire}><Icon name="bulb" /></button><button aria-label="关闭 Agent" onClick={() => setAgentOpen(false)}><Icon name="close" /></button></header>
          {!agentHasConversation && (
            <section className="agent-hero">
              <p className="agent-hi"><img src="/assets/genora-logo.png" alt="" />Hi! {TEMP_USER_NAME}</p>
              <h2>今天一起创作点什么？</h2>
              <div className="agent-suggestions">{visibleSuggestions.map((text) => <button key={text} onClick={() => useSuggestion(text)}>{text.length > 12 ? `${text.slice(0, 12)}...` : text}</button>)}</div>
            </section>
          )}
          <section className="agent-chat">{agentMessages.map((message, index) => <div key={index} className={`agent-message ${message.role} ${message.error ? "error" : ""}`}>{message.content}</div>)}{agentBusy && <div className="agent-message assistant">正在思考...</div>}</section>
          <footer>
            {!!agentAttachments.length && <div className="agent-attachments">{agentAttachments.map((item) => <div key={item.id} className="agent-attachment"><button onClick={() => setAgentAttachments((current) => current.filter((target) => target.id !== item.id))}><Icon name="close" /></button>{item.kind === "image" ? <img src={item.url} alt={item.name} /> : <video src={item.url} muted />}<span>{item.name}</span></div>)}</div>}
            <div className="agent-input-tools"><button title="上传图片" onClick={() => agentImagePicker.current?.click()}><Icon name="upload" /></button><button title="上传视频" onClick={() => agentVideoPicker.current?.click()}><Icon name="video" /></button></div>
            <textarea value={agentInput} onChange={(event) => setAgentInput(event.target.value)} placeholder="描述创意或需求，添加画布内容，@ 引用参考" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendAgent(); } }} />
            <div className="agent-send-row"><button className="agent-send" disabled={agentBusy} onClick={sendAgent}><Icon name="send" /></button></div>
          </footer>
        </aside>
      )}
    </main>
  );
}

export default function Home() {
  return <ReactFlowProvider><WorkflowCanvas /></ReactFlowProvider>;
}
