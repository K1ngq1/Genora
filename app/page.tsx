"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { estimateCredits, type CanvasRatio, type CanvasResolution, type ModelDefinition } from "@/lib/model-catalog";
import { isActiveTaskStatus, type TaskStatus as KnownTaskStatus } from "@/lib/task-status";
import { HOME_TASK_POLL_INTERVAL_MS } from "@/lib/video-polling";
import {
  HOME_LOGO,
  MODEL_COUNT,
  MOTION_PRESETS,
  RATIOS,
  RESOLUTIONS,
  modeLabel,
  modelsForKind,
  optionLabel,
  responseError,
  selectedModelFor,
  statusLabel,
  type HomeMode,
} from "@/features/home/home-options";
import "./home.css";

type TaskStatus = KnownTaskStatus | string;
type HomeTask = {
  id: string;
  taskId?: string;
  kind: HomeMode;
  status: TaskStatus;
  prompt: string;
  model: string;
  ratio: CanvasRatio;
  resolution: CanvasResolution;
  duration?: number;
  outputUrl?: string;
  error?: string;
};
type HomeMessage =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "task"; task: HomeTask };
type IconName =
  | "home"
  | "settings"
  | "nodes"
  | "mic"
  | "image"
  | "upload"
  | "spark"
  | "send"
  | "box"
  | "chevron-left"
  | "chevron-right";
type SpeechRecognitionResultLike = { 0: { transcript: string } };
type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type PublicTaskResponse = {
  id?: string;
  taskId?: string;
  type?: string;
  status?: TaskStatus;
  outputUrl?: string;
  error?: string;
  errorCode?: string;
  syncError?: string | null;
};

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

function getSpeechRecognition(): SpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const source = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return source.SpeechRecognition ?? source.webkitSpeechRecognition;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("READ_FILE_FAILED"));
    reader.readAsDataURL(file);
  });
}

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-8.5Z" />,
    settings: (
      <>
        <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
        <path d="M19 13.5v-3l-2.1-.5-.8-1.8 1.1-1.9-2.1-2.1-1.9 1.1-1.8-.8L10 2H7l-.5 2.1-1.8.8-1.9-1.1-2.1 2.1 1.1 1.9-.8 1.8L1 10v3l2.1.5.8 1.8-1.1 1.9 2.1 2.1 1.9-1.1 1.8.8L10 22h3l.5-2.1 1.8-.8 1.9 1.1 2.1-2.1-1.1-1.9.8-1.8 2-.5Z" />
      </>
    ),
    nodes: (
      <>
        <rect x="3" y="4" width="6" height="6" rx="1.5" />
        <rect x="15" y="4" width="6" height="6" rx="1.5" />
        <rect x="9" y="15" width="6" height="6" rx="1.5" />
        <path d="M9 7h6M12 10v5" />
      </>
    ),
    mic: (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <circle cx="8" cy="10" r="1.5" />
        <path d="m21 15-4.5-4.5L7 19" />
      </>
    ),
    upload: <path d="M12 16V4m0 0L8 8m4-4 4 4M5 16v3h14v-3" />,
    spark: <path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8Z" />,
    send: <path d="m22 2-7 20-4-9-9-4Z" />,
    box: (
      <>
        <path d="m12 3 7 4v8l-7 4-7-4V7Z" />
        <path d="m5 7 7 4 7-4M12 11v8" />
      </>
    ),
    "chevron-left": <path d="m15 18-6-6 6-6" />,
    "chevron-right": <path d="m9 18 6-6-6-6" />,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function GenoraMark({ className = "" }: { className?: string }) {
  return (
    <i className={`genora-mark ${className}`}>
      <img src={HOME_LOGO} alt="" />
    </i>
  );
}

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const pollTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mode, setMode] = useState<HomeMode>("image");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<HomeMessage[]>([]);
  const [generationBusy, setGenerationBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [imageModelId, setImageModelId] = useState("agnes-image-2.1-flash");
  const [videoModelId, setVideoModelId] = useState("agnes-video-v2.0");
  const [ratio, setRatio] = useState<CanvasRatio>("16:9");
  const [resolution, setResolution] = useState<CanvasResolution>("1k");
  const [duration, setDuration] = useState(5);
  const [motionPreset, setMotionPreset] = useState("auto");
  const [imagePreview, setImagePreview] = useState<string>();
  const [imageFile, setImageFile] = useState<File>();

  const imageModels = useMemo(() => modelsForKind("image"), []);
  const videoModels = useMemo(() => modelsForKind("video"), []);
  const currentModels = mode === "image" ? imageModels : videoModels;
  const selectedModel = selectedModelFor(mode, mode === "image" ? imageModelId : videoModelId);
  const availableResolutions = selectedModel.resolutions.length ? selectedModel.resolutions : RESOLUTIONS;
  const availableRatios = selectedModel.ratios.length ? selectedModel.ratios : RATIOS;
  const credits = estimateCredits({ model: selectedModel.id, resolution, duration, hasImageInput: Boolean(imageFile) });
  const creditLabel = selectedModel.free ? "Free" : `${credits.toFixed(2).replace(/\.00$/, "")} 积分`;
  const hasGeneration = messages.length > 0;

  useEffect(() => {
    const projectId = searchParams.get("project");
    if (!projectId) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("project");
    const suffix = next.toString();
    router.replace(`/workspace?project=${encodeURIComponent(projectId)}${suffix ? `&${suffix}` : ""}`);
  }, [router, searchParams]);

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  useEffect(() => () => {
    for (const timer of pollTimersRef.current.values()) clearTimeout(timer);
    pollTimersRef.current.clear();
  }, []);

  const selectModel = (model: ModelDefinition) => {
    if (model.kind === "image") setImageModelId(model.id);
    else setVideoModelId(model.id);
    if (!model.ratios.includes(ratio)) setRatio(model.defaultRatio);
    if (!model.resolutions.includes(resolution)) setResolution(model.defaultResolution);
    if (model.kind === "video") setDuration(Math.min(model.maxDuration ?? duration, Math.max(model.minDuration ?? duration, duration)));
    setModelMenuOpen(false);
  };

  const updateGridGlow = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--grid-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--grid-y", `${event.clientY - rect.top}px`);
  };

  const updateTaskMessage = (messageId: string, patch: Partial<HomeTask>) => {
    setMessages((current) => current.map((message) => {
      if (message.role !== "task" || message.id !== messageId) return message;
      return { ...message, task: { ...message.task, ...patch } };
    }));
  };

  const pollHomeTask = (taskId: string, messageId: string) => {
    const run = async () => {
      try {
        const response = await fetch(`/api/tasks/${taskId}`, { cache: "no-store" });
        const body = await readJson(response) as PublicTaskResponse;
        if (!response.ok) throw new Error(responseError(body as Record<string, unknown>, "TASK_POLL_FAILED"));
        const status = body.status ?? "processing";
        updateTaskMessage(messageId, {
          status,
          taskId: body.taskId,
          outputUrl: body.outputUrl,
          error: body.errorCode ?? body.error ?? body.syncError ?? undefined,
        });
        if (isActiveTaskStatus(status)) {
          const timer = setTimeout(run, HOME_TASK_POLL_INTERVAL_MS);
          pollTimersRef.current.set(messageId, timer);
        } else {
          pollTimersRef.current.delete(messageId);
        }
      } catch (error) {
        updateTaskMessage(messageId, { status: "failed", error: error instanceof Error ? error.message : "任务查询失败" });
        pollTimersRef.current.delete(messageId);
      }
    };
    const existing = pollTimersRef.current.get(messageId);
    if (existing) clearTimeout(existing);
    void run();
  };

  const submitHomeGeneration = async () => {
    const content = prompt.trim();
    if (!content || generationBusy) return;
    const userMessageId = crypto.randomUUID();
    const taskMessageId = crypto.randomUUID();
    const taskModel = selectedModel;
    setMessages((current) => [
      ...current,
      { id: userMessageId, role: "user", content },
      {
        id: taskMessageId,
        role: "task",
        task: {
          id: taskMessageId,
          kind: mode,
          status: "submitting",
          prompt: content,
          model: taskModel.label,
          ratio,
          resolution,
          duration: mode === "video" ? duration : undefined,
        },
      },
    ]);
    setGenerationBusy(true);

    try {
      let response: Response;
      if (mode === "image") {
        const referenceUrls = imageFile && taskModel.supportsReferences ? [await fileToDataUrl(imageFile)] : [];
        if (imageFile && !taskModel.supportsReferences) throw new Error("当前图像模型不支持参考图，请移除上传图片后重试。");
        response = await fetch("/api/images/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: content,
            model: taskModel.id,
            ratio,
            aspectRatio: ratio,
            resolution,
            quality: resolution,
            referenceUrls,
          }),
        });
      } else {
        const form = new FormData();
        form.set("prompt", content);
        form.set("model", taskModel.id);
        form.set("ratio", ratio);
        form.set("aspectRatio", ratio);
        form.set("resolution", resolution);
        form.set("quality", resolution);
        form.set("duration", String(duration));
        const motion = MOTION_PRESETS.find((item) => item.id === motionPreset);
        if (motion) form.set("motionPreset", motion.id);
        if (imageFile) form.set("startFrame", imageFile, imageFile.name);
        response = await fetch("/api/videos/generate", { method: "POST", body: form });
      }
      const body = await readJson(response) as PublicTaskResponse;
      if (!response.ok) throw new Error(responseError(body as Record<string, unknown>, "GENERATION_FAILED"));
      if (!body.id) throw new Error("GENERATION_TASK_MISSING");
      updateTaskMessage(taskMessageId, { id: body.id, status: body.status ?? "queued", outputUrl: body.outputUrl });
      if (body.outputUrl || body.status === "completed") {
        updateTaskMessage(taskMessageId, { status: "completed" });
      } else {
        pollHomeTask(body.id, taskMessageId);
      }
      setPrompt("");
    } catch (error) {
      updateTaskMessage(taskMessageId, { status: "failed", error: error instanceof Error ? error.message : "生成失败" });
    } finally {
      setGenerationBusy(false);
    }
  };

  const startVoiceInput = async () => {
    setVoiceError("");
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setVoiceError("当前浏览器不支持语音识别。");
      return;
    }
    try {
      await navigator.mediaDevices?.getUserMedia({ audio: true });
      recognitionRef.current?.stop();
      const recognition = new Recognition();
      recognition.lang = "zh-CN";
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.onresult = (event) => {
        let transcript = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) transcript += event.results[index][0].transcript;
        if (transcript.trim()) setPrompt((current) => `${current}${current ? " " : ""}${transcript.trim()}`);
      };
      recognition.onend = () => setVoiceBusy(false);
      recognition.onerror = () => {
        setVoiceBusy(false);
        setVoiceError("语音识别失败，请检查麦克风权限。");
      };
      recognitionRef.current = recognition;
      setVoiceBusy(true);
      recognition.start();
    } catch {
      setVoiceBusy(false);
      setVoiceError("无法访问麦克风，请允许浏览器麦克风权限。");
    }
  };

  const selectImage = (file?: File) => {
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  return (
    <main className={`home-page ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${hasGeneration ? "has-generation" : ""}`}>
      <aside className={`home-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <Link className="home-sidebar-logo logo-button" href="/" aria-label="Genora" title="Genora" data-label="Genora">
          <GenoraMark />
          <span>Genora</span>
        </Link>
        <nav aria-label="主导航">
          <Link className="logo-button active" href="/" title="首页" data-label="首页"><Icon name="home" /><span>首页</span></Link>
          <Link className="logo-button" href="/projects" title="工作空间" data-label="工作空间"><Icon name="nodes" /><span>工作空间</span></Link>
        </nav>
        <div className="home-sidebar-bottom">
          <Link className="logo-button" href="/settings" title="设置" data-label="设置"><Icon name="settings" /><span>设置</span></Link>
          <button className="home-collapse" type="button" onClick={() => setSidebarCollapsed((current) => !current)} title={sidebarCollapsed ? "展开" : "收起"} data-label={sidebarCollapsed ? "展开" : "收起"}>
            <Icon name={sidebarCollapsed ? "chevron-right" : "chevron-left"} />
            <span>{sidebarCollapsed ? "展开" : "收起"}</span>
          </button>
        </div>
      </aside>

      <section className="home-main" onPointerMove={updateGridGlow}>
        <div className="home-grid" />
        <section className="home-stage" aria-label="对话区域">
          {!hasGeneration && (
            <div className="home-stage-empty">
              <GenoraMark className="stage-mark" />
              <h1 className="home-shell-title">今天要做点什么？</h1>
              <span>已接入 {MODEL_COUNT} 个创作模型</span>
            </div>
          )}
          {messages.map((message) => (
            message.role === "user" ? (
              <article key={message.id} className="home-message user">{message.content}</article>
            ) : (
              <article key={message.id} className={`home-task-card ${message.task.kind} ${message.task.status}`}>
                <header>
                  <span>{modeLabel(message.task.kind)}</span>
                  <b>{statusLabel(message.task.status)}</b>
                </header>
                <p>{message.task.prompt}</p>
                {message.task.outputUrl && message.task.kind === "image" && <img src={message.task.outputUrl} alt={message.task.prompt} />}
                {message.task.outputUrl && message.task.kind === "video" && <video src={message.task.outputUrl} controls />}
                {message.task.error && <em>{message.task.error}</em>}
                <footer>
                  <span>{message.task.model}</span>
                  <span>{message.task.ratio}</span>
                  <span>{optionLabel(message.task.resolution)}</span>
                  {message.task.duration && <span>{message.task.duration} 秒</span>}
                </footer>
              </article>
            )
          ))}
        </section>

        <section className={`home-composer-dock ${hasGeneration ? "has-generation" : ""}`} aria-label="创作对话框">
          <div className="home-mode-tabs">
            <button type="button" className={mode === "image" ? "active" : ""} onClick={() => { setMode("image"); setModelMenuOpen(false); }}><Icon name="image" />图像生成</button>
            <button type="button" className={mode === "video" ? "active" : ""} onClick={() => { setMode("video"); setModelMenuOpen(false); }}><Icon name="spark" />视频生成</button>
          </div>

          <p className="home-composer-hint">
            {mode === "image" ? "可直接文字生图，或上传图片输入文字指令对图片进行编辑。" : "描述视频场景、镜头方向和节奏，或上传图片生成动态画面。"}
          </p>

          <input ref={imageInputRef} hidden type="file" accept="image/*" onChange={(event) => selectImage(event.target.files?.[0])} />
          <button className="home-upload-strip" type="button" onClick={() => imageInputRef.current?.click()}>
            {imagePreview ? <img src={imagePreview} alt="" /> : <><Icon name="upload" />上传图片</>}
          </button>

          {mode === "video" && (
            <div className="home-video-options">
              <label>
                <span>镜头方向</span>
                <select value={motionPreset} onChange={(event) => setMotionPreset(event.target.value)}>
                  {MOTION_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
              <label className="duration-control">
                <span>{duration} 秒</span>
                <input type="range" min={selectedModel.minDuration ?? 1} max={selectedModel.maxDuration ?? 18} value={duration} onChange={(event) => setDuration(Number(event.target.value))} />
              </label>
            </div>
          )}

          <div className="home-composer">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={mode === "image" ? "描述想生成的画面，或上传图片继续编辑..." : "描述视频场景、镜头运动和节奏..."}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submitHomeGeneration();
                }
              }}
            />
            <div className="home-composer-footer">
              <div className="home-footer-controls">
                <div className="home-model-picker">
                  <button type="button" onClick={() => setModelMenuOpen((current) => !current)}><Icon name="box" />{selectedModel.label}</button>
                  {modelMenuOpen && (
                    <div className="home-model-menu">
                      {currentModels.map((model) => (
                        <button key={model.id} type="button" className={model.id === selectedModel.id ? "selected" : ""} onClick={() => selectModel(model)}>
                          <span>{model.label}</span>
                          <small>{model.free ? "Free" : model.provider}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <select className="home-ratio-select" value={ratio} onChange={(event) => setRatio(event.target.value as CanvasRatio)}>
                  {RATIOS.map((item) => <option key={item} value={item} disabled={!availableRatios.includes(item)}>{item}</option>)}
                </select>
                <select className="home-resolution-select" value={resolution} onChange={(event) => setResolution(event.target.value as CanvasResolution)}>
                  {RESOLUTIONS.map((item) => <option key={item} value={item} disabled={!availableResolutions.includes(item)}>{optionLabel(item)}</option>)}
                </select>
              </div>
              <div className="home-composer-actions">
                <span className="home-credit-pill">{creditLabel}</span>
                <button className={`voice-button ${voiceBusy ? "active" : ""}`} type="button" onClick={() => void startVoiceInput()} title="语音输入"><Icon name="mic" /></button>
                <button className="submit-button" type="button" onClick={() => void submitHomeGeneration()} disabled={generationBusy || !prompt.trim()} title="生成"><span>生成</span><Icon name="send" /></button>
              </div>
            </div>
          </div>
          {voiceError && <p className="voice-error">{voiceError}</p>}
        </section>
      </section>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<main className="home-page" />}>
      <HomePageContent />
    </Suspense>
  );
}
