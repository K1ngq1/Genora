"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { estimateCredits, type CanvasRatio, type CanvasResolution, type ModelDefinition } from "@/lib/model-catalog";
import { isActiveTaskStatus } from "@/lib/task-status";
import { HOME_TASK_POLL_INTERVAL_MS } from "@/lib/video-polling";
import {
  MOTION_PRESETS,
  RATIOS,
  RESOLUTIONS,
  modelsForKind,
  optionLabel,
  responseError,
  selectedModelFor,
  type HomeMode,
} from "@/features/home/home-options";
import { fileToDataUrl, readJson, type PublicTaskResponse } from "@/features/home/home-api";
import { Icon } from "@/features/home/home-icons";
import { HomeSidebar } from "@/features/home/home-sidebar";
import { HomeStage } from "@/features/home/home-stage";
import { getSpeechRecognition, type SpeechRecognitionLike } from "@/features/home/speech-recognition";
import type { HomeChatSession, HomeMessage, HomeTask } from "@/features/home/home-types";
import { useAuth } from "@/features/auth/auth-provider";
import "./home.css";

const HOME_CHAT_STORAGE_KEY = "genora.home.chatSessions.v1";

function chatTitleFromPrompt(prompt: string) {
  const cleaned = prompt.replace(/\s+/g, " ").replace(/[，。,.!?！？、；;:：]/g, " ").trim();
  if (!cleaned) return "新的创作对话";
  const compact = cleaned.replace(/^(请|帮我|帮|给我|生成|制作|创建|设计|画|写|做)/, "").trim() || cleaned;
  return compact.length > 16 ? compact.slice(0, 16) : compact;
}

function readStoredSessions(): HomeChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HOME_CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HomeChatSession[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.id === "string" && Array.isArray(item.messages))
      .slice(0, 40);
  } catch {
    return [];
  }
}

function storeSessions(sessions: HomeChatSession[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HOME_CHAT_STORAGE_KEY, JSON.stringify(sessions.slice(0, 40)));
}

function HomePageContent() {
  const router = useRouter();
  const { requireAuth, hydrated, isAuthed, openAuthDialog } = useAuth();
  const searchParams = useSearchParams();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const pollTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mode, setMode] = useState<HomeMode>("image");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [ratioMenuOpen, setRatioMenuOpen] = useState(false);
  const [resolutionMenuOpen, setResolutionMenuOpen] = useState(false);
  const [motionMenuOpen, setMotionMenuOpen] = useState(false);
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
  const [chatSessions, setChatSessions] = useState<HomeChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>();

  const imageModels = useMemo(() => modelsForKind("image"), []);
  const videoModels = useMemo(() => modelsForKind("video"), []);
  const currentModels = mode === "image" ? imageModels : videoModels;
  const selectedModel = selectedModelFor(mode, mode === "image" ? imageModelId : videoModelId);
  const availableResolutions = selectedModel.resolutions.length ? selectedModel.resolutions : RESOLUTIONS;
  const availableRatios = selectedModel.ratios.length ? selectedModel.ratios : RATIOS;
  const selectedMotion = MOTION_PRESETS.find((item) => item.id === motionPreset) ?? MOTION_PRESETS[0];
  const credits = estimateCredits({ model: selectedModel.id, resolution, duration, hasImageInput: Boolean(imageFile) });
  const creditLabel = selectedModel.free ? "Free" : `${credits.toFixed(2).replace(/\.00$/, "")} 积分`;
  const hasGeneration = messages.length > 0;

  const sessionFromMessages = (sessionId: string, nextMessages: HomeMessage[], title?: string, createdAt?: string): HomeChatSession => {
    const now = new Date().toISOString();
    return {
      id: sessionId,
      title: title ?? chatTitleFromPrompt(nextMessages.find((message) => message.role === "user")?.content ?? prompt),
      createdAt: createdAt ?? now,
      updatedAt: now,
      messages: nextMessages,
      mode,
      model: selectedModel.id,
      aspectRatio: ratio,
      quality: resolution,
      duration: mode === "video" ? duration : undefined,
      motionPreset: mode === "video" ? motionPreset : undefined,
      outputs: nextMessages.flatMap((message) => message.role === "task" && message.task.outputUrl ? [message.task.outputUrl] : []),
    };
  };

  const saveSession = (sessionId: string, nextMessages: HomeMessage[]) => {
    if (!nextMessages.length) return;
    setChatSessions((current) => {
      const existing = current.find((session) => session.id === sessionId);
      const nextSession = sessionFromMessages(sessionId, nextMessages, existing?.title, existing?.createdAt);
      const next = [nextSession, ...current.filter((session) => session.id !== sessionId)].slice(0, 40);
      storeSessions(next);
      return next;
    });
  };


  useEffect(() => {
    const projectId = searchParams.get("project");
    if (!projectId) return;
    if (!hydrated) return;
    if (!isAuthed) {
      openAuthDialog("canvas");
      return;
    }
    const next = new URLSearchParams(searchParams.toString());
    next.delete("project");
    const suffix = next.toString();
    router.replace(`/workspace?project=${encodeURIComponent(projectId)}${suffix ? `&${suffix}` : ""}`);
  }, [router, searchParams, hydrated, isAuthed, openAuthDialog]);

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  useEffect(() => () => {
    for (const timer of pollTimersRef.current.values()) clearTimeout(timer);
    pollTimersRef.current.clear();
  }, []);

  useEffect(() => {
    setChatSessions(readStoredSessions());
  }, []);

  useEffect(() => {
    if (!activeSessionId || !messages.length) return;
    saveSession(activeSessionId, messages);
  }, [activeSessionId, messages, mode, selectedModel.id, ratio, resolution, duration, motionPreset]);


  const selectModel = (model: ModelDefinition) => {
    if (model.kind === "image") setImageModelId(model.id);
    else setVideoModelId(model.id);
    if (!model.ratios.includes(ratio)) setRatio(model.defaultRatio);
    if (!model.resolutions.includes(resolution)) setResolution(model.defaultResolution);
    if (model.kind === "video") setDuration(Math.min(model.maxDuration ?? duration, Math.max(model.minDuration ?? duration, duration)));
    setModelMenuOpen(false);
    setRatioMenuOpen(false);
    setResolutionMenuOpen(false);
    setMotionMenuOpen(false);
  };

  const clearImageInput = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(undefined);
    setImageFile(undefined);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const startNewChat = () => {
    setActiveSessionId(crypto.randomUUID());
    setMessages([]);
    setPrompt("");
    setGenerationBusy(false);
    setVoiceError("");
    clearImageInput();
    setModelMenuOpen(false);
    setRatioMenuOpen(false);
    setResolutionMenuOpen(false);
    setMotionMenuOpen(false);
  };

  const selectChatSession = (sessionId: string) => {
    const session = chatSessions.find((item) => item.id === sessionId);
    if (!session) return;
    setActiveSessionId(session.id);
    setMessages(session.messages);
    setPrompt("");
    setMode(session.mode);
    if (session.mode === "image") setImageModelId(session.model);
    else setVideoModelId(session.model);
    setRatio(session.aspectRatio);
    setResolution(session.quality);
    setDuration(session.duration ?? 5);
    setMotionPreset(session.motionPreset ?? "auto");
    clearImageInput();
    setModelMenuOpen(false);
    setRatioMenuOpen(false);
    setResolutionMenuOpen(false);
    setMotionMenuOpen(false);
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
    if (!requireAuth("submit")) return;
    const userMessageId = crypto.randomUUID();
    const taskMessageId = crypto.randomUUID();
    const taskModel = selectedModel;
    const sessionId = activeSessionId ?? crypto.randomUUID();
    if (!activeSessionId) setActiveSessionId(sessionId);
    const nextMessages: HomeMessage[] = [
      ...messages,
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
    ];
    setMessages(nextMessages);
    saveSession(sessionId, nextMessages);
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
      <HomeSidebar
        collapsed={sidebarCollapsed}
        sessions={chatSessions}
        activeSessionId={activeSessionId}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        onNewChat={startNewChat}
        onSelectSession={selectChatSession}
      />

      <section className="home-main" onPointerMove={updateGridGlow}>
        <div className="home-grid" />
        <HomeStage hasGeneration={hasGeneration} messages={messages} />

        <section className={`home-composer-dock ${hasGeneration ? "has-generation" : ""}`} aria-label="创作对话框">
          <div className="home-mode-tabs">
            <button type="button" className={mode === "image" ? "active" : ""} onClick={() => { setMode("image"); setModelMenuOpen(false); setRatioMenuOpen(false); setResolutionMenuOpen(false); setMotionMenuOpen(false); }}><Icon name="image" />图像生成</button>
            <button type="button" className={mode === "video" ? "active" : ""} onClick={() => { setMode("video"); setModelMenuOpen(false); setRatioMenuOpen(false); setResolutionMenuOpen(false); setMotionMenuOpen(false); }}><Icon name="spark" />视频生成</button>
          </div>

          <p className="home-composer-hint">
            {mode === "image" ? "可直接文字生图，或上传图片输入文字指令对图片进行编辑。" : "描述视频场景、镜头方向和节奏，或上传图片生成动态画面。"}
          </p>

          <input ref={imageInputRef} hidden type="file" accept="image/*" onChange={(event) => selectImage(event.target.files?.[0])} />
          <div className="home-upload-row">
            {mode === "video" && (
              <div className={`home-capsule-select home-motion-picker ${motionMenuOpen ? "open" : ""}`}>
                <button className="home-select-trigger home-motion-trigger" type="button" onClick={() => { setMotionMenuOpen((current) => !current); setModelMenuOpen(false); setRatioMenuOpen(false); setResolutionMenuOpen(false); }} aria-expanded={motionMenuOpen}>
                  <span>镜头方向</span>
                  <b>{selectedMotion.label}</b>
                  <Icon name="chevron-down" />
                </button>
                {motionMenuOpen && (
                  <div className="home-capsule-menu home-motion-menu">
                    {MOTION_PRESETS.map((item) => (
                      <button key={item.id} type="button" className={motionPreset === item.id ? "selected" : ""} onClick={() => { setMotionPreset(item.id); setMotionMenuOpen(false); }}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button className={`home-upload-strip ${imagePreview ? "has-preview" : ""}`} type="button" onClick={() => imageInputRef.current?.click()} title="????">
              {imagePreview ? <img src={imagePreview} alt="" /> : <Icon name="plus" />}
            </button>
          </div>

          {mode === "video" && (
            <div className="home-video-options home-video-duration-options">
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
                  <button className="home-model-trigger" type="button" onClick={() => { setModelMenuOpen((current) => !current); setRatioMenuOpen(false); setResolutionMenuOpen(false); setMotionMenuOpen(false); }} aria-expanded={modelMenuOpen}>
                    <span className="home-model-logo"><Icon name="box" /></span>
                    <span className="home-model-trigger-copy">{selectedModel.label}</span>
                    <Icon name="chevron-down" />
                  </button>
                  {modelMenuOpen && (
                    <div className="home-model-menu">
                      {currentModels.map((model) => (
                        <button key={model.id} type="button" className={model.id === selectedModel.id ? "selected" : ""} onClick={() => selectModel(model)}>
                          <span className="home-model-logo"><Icon name="box" /></span>
                          <span className="home-model-copy">
                            <b>{model.label}</b>
                            <small>{model.free ? "Free" : model.provider}</small>
                          </span>
                          <em>{model.kind === "image" ? "图像" : "视频"}</em>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className={`home-capsule-select home-ratio-picker ${ratioMenuOpen ? "open" : ""}`}>
                  <button className="home-select-trigger" type="button" onClick={() => { setRatioMenuOpen((current) => !current); setModelMenuOpen(false); setResolutionMenuOpen(false); setMotionMenuOpen(false); }} aria-expanded={ratioMenuOpen}>
                    <span>{ratio}</span>
                    <Icon name="chevron-down" />
                  </button>
                  {ratioMenuOpen && (
                    <div className="home-capsule-menu home-ratio-menu">
                      {RATIOS.map((item) => {
                        const supported = availableRatios.includes(item);
                        return (
                          <button key={item} type="button" disabled={!supported} className={ratio === item ? "selected" : ""} onClick={() => { if (!supported) return; setRatio(item); setRatioMenuOpen(false); }}>
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className={`home-capsule-select home-resolution-picker ${resolutionMenuOpen ? "open" : ""}`}>
                  <button className="home-select-trigger" type="button" onClick={() => { setResolutionMenuOpen((current) => !current); setModelMenuOpen(false); setRatioMenuOpen(false); setMotionMenuOpen(false); }} aria-expanded={resolutionMenuOpen}>
                    <span>{optionLabel(resolution)}</span>
                    <Icon name="chevron-down" />
                  </button>
                  {resolutionMenuOpen && (
                    <div className="home-capsule-menu home-resolution-menu">
                      {RESOLUTIONS.map((item) => {
                        const supported = availableResolutions.includes(item);
                        return (
                          <button key={item} type="button" disabled={!supported} className={resolution === item ? "selected" : ""} onClick={() => { if (!supported) return; setResolution(item); setResolutionMenuOpen(false); }}>
                            {optionLabel(item)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="home-composer-actions">
                <button className={`voice-button ${voiceBusy ? "active" : ""}`} type="button" onClick={() => void startVoiceInput()} title="语音输入"><Icon name="mic" /></button>
                <button className="submit-button" type="button" onClick={() => void submitHomeGeneration()} disabled={generationBusy || !prompt.trim()} title="生成"><span>{creditLabel}</span><Icon name="send" /></button>
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
