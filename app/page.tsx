"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  MODEL_CATALOG,
  estimateCredits,
  modelsForKind,
  type CanvasRatio,
  type CanvasResolution,
  type GenerationKind,
  type ModelDefinition,
} from "@/lib/model-catalog";
import "./home.css";

type HomeMessage = { role: "user" | "assistant"; content: string; error?: boolean };
type HomeMode = Extract<GenerationKind, "image" | "video">;
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

const HOME_LOGO = "/assets/genora-logo.png";
const MODEL_COUNT = MODEL_CATALOG.length;
const RATIOS: CanvasRatio[] = ["1:1", "4:3", "3:4", "16:9", "9:16"];
const RESOLUTIONS: CanvasResolution[] = ["480p", "720p", "1080p", "1k", "2k", "4k", "adaptive"];
const MOTION_PRESETS = [
  { id: "auto", label: "自动镜头" },
  { id: "push-in", label: "缓慢推进" },
  { id: "pull-out", label: "缓慢拉远" },
  { id: "pan-left", label: "向左横移" },
  { id: "pan-right", label: "向右横移" },
  { id: "orbit-left", label: "左侧环绕" },
  { id: "orbit-right", label: "右侧环绕" },
];

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

function modeLabel(mode: HomeMode) {
  return mode === "image" ? "图像生成" : "视频生成";
}

function selectedModelFor(mode: HomeMode, modelId: string) {
  return modelsForKind(mode).find((model) => model.id === modelId) ?? modelsForKind(mode)[0];
}

function getSpeechRecognition(): SpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const source = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return source.SpeechRecognition ?? source.webkitSpeechRecognition;
}

function optionLabel(value: CanvasResolution) {
  return value === "adaptive" ? "自适应" : value.toUpperCase();
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mode, setMode] = useState<HomeMode>("image");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<HomeMessage[]>([]);
  const [agentBusy, setAgentBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [imageModelId, setImageModelId] = useState("agnes-image-2.1-flash");
  const [videoModelId, setVideoModelId] = useState("agnes-video-v2.0");
  const [ratio, setRatio] = useState<CanvasRatio>("16:9");
  const [resolution, setResolution] = useState<CanvasResolution>("1k");
  const [duration, setDuration] = useState(5);
  const [motionPreset, setMotionPreset] = useState("auto");
  const [imagePreview, setImagePreview] = useState<string>();

  const imageModels = useMemo(() => modelsForKind("image"), []);
  const videoModels = useMemo(() => modelsForKind("video"), []);
  const currentModels = mode === "image" ? imageModels : videoModels;
  const selectedModel = selectedModelFor(mode, mode === "image" ? imageModelId : videoModelId);
  const availableResolutions = selectedModel.resolutions.length ? selectedModel.resolutions : RESOLUTIONS;
  const availableRatios = selectedModel.ratios.length ? selectedModel.ratios : RATIOS;
  const credits = estimateCredits({ model: selectedModel.id, resolution, duration, hasImageInput: Boolean(imagePreview) });
  const creditLabel = selectedModel.free ? "Free" : `预计 ${credits.toFixed(2).replace(/\.00$/, "")} 积分`;

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

  const selectModel = (model: ModelDefinition) => {
    if (model.kind === "image") setImageModelId(model.id);
    else setVideoModelId(model.id);
    if (!model.ratios.includes(ratio)) setRatio(model.defaultRatio);
    if (!model.resolutions.includes(resolution)) setResolution(model.defaultResolution);
    if (model.kind === "video") setDuration(Math.min(model.maxDuration ?? duration, Math.max(model.minDuration ?? duration, duration)));
    setModelMenuOpen(false);
  };

  const updateGridGlow = (event: React.PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--grid-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--grid-y", `${event.clientY - rect.top}px`);
  };

  const submitHomePrompt = async () => {
    const content = prompt.trim();
    if (!content || agentBusy) return;
    setMessages((current) => [...current, { role: "user", content }]);
    setAgentBusy(true);

    try {
      const context = [
        "你是 Genora 首页创作 Agent。请根据用户输入、生成类型和模型参数给出可执行创作建议。",
        "不要跳转页面。请用简洁中文回复，并给出适合继续生成图像或视频的提示词。",
        "",
        `生成类型：${modeLabel(mode)}`,
        `当前模型：${selectedModel.label}`,
        `比例：${ratio}`,
        `画质：${optionLabel(resolution)}`,
        mode === "video" ? `时长：${duration} 秒` : "",
        mode === "video" ? `镜头方向：${MOTION_PRESETS.find((item) => item.id === motionPreset)?.label ?? motionPreset}` : "",
        imagePreview ? "用户已上传参考图片。" : "用户未上传参考图片。",
        "",
        `用户输入：${content}`,
      ].filter(Boolean).join("\n");
      const response = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "agnes-2.0-flash", prompt: context, messages: [{ role: "user", content: context }] }),
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(String(body.errorCode ?? body.error ?? "Agent 调用失败"));
      setMessages((current) => [...current, { role: "assistant", content: String(body.text ?? "已收到，我会基于当前模型参数继续整理创作方案。") }]);
      setPrompt("");
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : "Agent 调用失败", error: true }]);
    } finally {
      setAgentBusy(false);
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
    setImagePreview(URL.createObjectURL(file));
  };

  return (
    <main className={`home-page ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
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
          {!messages.length && (
            <div className="home-stage-empty">
              <GenoraMark className="stage-mark" />
              <h1>今天要做点什么？</h1>
              <span>已接入 {MODEL_COUNT} 个创作模型</span>
            </div>
          )}
          {messages.map((message, index) => (
            <article key={`${message.role}-${index}`} className={`home-message ${message.role} ${message.error ? "error" : ""}`}>{message.content}</article>
          ))}
          {agentBusy && <article className="home-message assistant">正在思考...</article>}
        </section>

        <section className="home-composer-dock" aria-label="创作对话框">
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
                  void submitHomePrompt();
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
                {mode === "video" && <span className="home-credit-pill">{creditLabel}</span>}
                <button className={`voice-button ${voiceBusy ? "active" : ""}`} type="button" onClick={() => void startVoiceInput()} title="语音输入"><Icon name="mic" /></button>
                <button className="submit-button" type="button" onClick={() => void submitHomePrompt()} disabled={agentBusy || !prompt.trim()} title="提交"><Icon name="send" /></button>
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
