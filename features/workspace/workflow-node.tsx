import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from "@xyflow/react";
import { estimateCredits, getModelDefinition, modelCapabilityLabel, modelsForKind, normalizeModelOptions } from "@/lib/model-catalog";
import { getProviderLogo } from "@/lib/provider-logo-map";
import { getVideoModelCapabilities, sanitizeVideoOptionsForModel, videoModeLabels } from "@/lib/video-model-capabilities";
import { getAdaptiveMediaLayout, type AdaptiveMediaLayout } from "@/lib/node-media-layout";
import { KIND_META, MOTION_PRESETS, RATIOS, VIDEO_QUALITIES } from "./workspace-constants";
import { qualityLabel } from "./workspace-utils";
import { Icon } from "./workspace-icon";
import type { WorkNode } from "./workspace-types";
function modelLogoClass(modelId: string) {
  const id = modelId.toLowerCase();
  if (id.includes("gemini")) return "model-logo-google";
  if (id.includes("gpt")) return "model-logo-openai";
  if (id.includes("kling")) return "model-logo-kling";
  if (id.includes("happyhorse")) return "model-logo-horse";
  if (id.includes("grok")) return "model-logo-xai";
  if (id.includes("agnes")) return "model-logo-agnes";
  if (id.includes("seedance") || id.includes("doubao")) return "model-logo-seedance";
  return "model-logo-generic";
}

function ModelLogoMark({ model, className = "" }: { model: ReturnType<typeof getModelDefinition>; className?: string }) {
  const logo = getProviderLogo(model.provider);
  return (
    <span className={`model-logo-mark ${modelLogoClass(model.id)} ${logo.src ? "has-logo" : "empty-logo"} ${className}`} title={logo.label}>
      {logo.src ? <img src={logo.src} alt="" /> : null}
    </span>
  );
}

function WorkflowNode({ id, data }: NodeProps<WorkNode>) {
  const picker = useRef<HTMLInputElement>(null);
  const startFramePicker = useRef<HTMLInputElement>(null);
  const endFramePicker = useRef<HTMLInputElement>(null);
  const referenceFramePicker = useRef<HTMLInputElement>(null);
  const meta = KIND_META[data.kind];
  const isMedia = data.kind.startsWith("media-");
  const [motionOpen, setMotionOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [mediaLayout, setMediaLayout] = useState<AdaptiveMediaLayout>();
  const updateNodeInternals = useUpdateNodeInternals();
  const generationKind = data.kind === "image" || data.kind === "video" ? data.kind : undefined;
  const selectedModelId = data.model ?? (data.kind === "image" ? "agnes-image-2.1-flash" : "agnes-video-v2.0");
  const selectedModel = generationKind ? getModelDefinition(selectedModelId) : undefined;
  const availableModels = generationKind ? modelsForKind(generationKind) : [];
  const qualityOptions = data.kind === "video" ? VIDEO_QUALITIES : selectedModel?.resolutions ?? [];
  const videoCapabilities = data.kind === "video" && selectedModel ? getVideoModelCapabilities(selectedModel.id) : undefined;
  const videoOptions = videoCapabilities ? sanitizeVideoOptionsForModel(selectedModelId, {
    mode: data.videoMode,
    aspectRatio: data.ratio,
    resolution: data.quality,
    duration: data.duration,
    hasStartFrame: Boolean(data.startFrameUrl),
    hasEndFrame: Boolean(data.endFrameUrl),
    hasImageInput: Boolean(data.referenceFrameUrls?.length || data.hasImageInput),
  }) : undefined;
  const videoSettingsSummary = videoOptions
    ? `${videoModeLabels[videoOptions.mode]} · ${videoOptions.aspectRatio} · ${qualityLabel(videoOptions.resolution)} · ${videoOptions.duration}s`
    : "";
  const referenceFrameUrls = data.referenceFrameUrls ?? [];
  const referenceFrameNames = data.referenceFrameNames ?? [];
  const maxReferenceImages = videoCapabilities?.maxReferenceImages ?? 0;
  const canAddReferenceFrame = maxReferenceImages === 0 || referenceFrameUrls.length < maxReferenceImages;
  const frameMode = videoOptions?.mode ?? "text";
  const estimatedCredits = selectedModel ? estimateCredits({
    model: selectedModel.id,
    resolution: data.quality,
    duration: data.duration,
    hasImageInput: Boolean(data.startFrameUrl || data.endFrameUrl || data.referenceFrameUrls?.length || data.hasImageInput),
  }) : 0;
  const promptHeight = Math.min(260, Math.max(96, 78 + data.prompt.length / 3 + data.prompt.split("\n").length * 20));
  const textLengthClass = data.result && data.kind === "text"
    ? data.result.length > 900 ? "text-long" : data.result.length > 420 ? "text-medium" : "text-short"
    : "";
  const importMedia = async (file?: File) => {
    if (!file) return;
    try {
      const url = await data.uploadAsset(file);
      data.update(id, {
        kind: file.type.startsWith("video/") ? "media-video" : "media-image",
        title: file.name,
        url,
        result: undefined,
        error: "",
      });
    } catch (error) {
      data.update(id, { error: error instanceof Error ? error.message : "UPLOAD_FAILED" });
    }
  };
  const importFrame = async (slot: "start" | "end", file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      data.update(id, { error: "首尾帧只能上传图片素材。" });
      return;
    }
    try {
      const url = await data.uploadAsset(file);
      if (slot === "start") {
        data.update(id, { startFrameUrl: url, startFrameName: file.name, error: "" });
      } else {
        data.update(id, { endFrameUrl: url, endFrameName: file.name, error: "" });
      }
    } catch (error) {
      data.update(id, { error: error instanceof Error ? error.message : "UPLOAD_FAILED" });
    }
  };
  const importReferenceFrames = async (files: File[]) => {
    if (!files.length || !videoCapabilities?.supportsReferenceImages || !canAddReferenceFrame) return;
    const slots = maxReferenceImages ? Math.max(0, maxReferenceImages - referenceFrameUrls.length) : files.length;
    const accepted = files.slice(0, slots).filter((file) => file.type.startsWith("image/"));
    if (!accepted.length) {
      data.update(id, { error: "REFERENCE_IMAGE_ONLY" });
      return;
    }
    try {
      const uploaded = await Promise.all(accepted.map(async (file) => ({ name: file.name, url: await data.uploadAsset(file) })));
      data.update(id, {
        referenceFrameUrls: [...referenceFrameUrls, ...uploaded.map((item) => item.url)].slice(0, maxReferenceImages || undefined),
        referenceFrameNames: [...referenceFrameNames, ...uploaded.map((item) => item.name)].slice(0, maxReferenceImages || undefined),
        error: "",
      });
    } catch (error) {
      data.update(id, { error: error instanceof Error ? error.message : "UPLOAD_FAILED" });
    }
  };
  const removeFrame = (slot: "start" | "end") => {
    data.update(id, slot === "start"
      ? { startFrameUrl: undefined, startFrameName: undefined }
      : { endFrameUrl: undefined, endFrameName: undefined });
  };
  const removeReferenceFrame = (index: number) => {
    data.update(id, {
      referenceFrameUrls: referenceFrameUrls.filter((_, itemIndex) => itemIndex !== index),
      referenceFrameNames: referenceFrameNames.filter((_, itemIndex) => itemIndex !== index),
    });
  };
  const openNextFramePicker = () => {
    if (!data.startFrameUrl) {
      startFramePicker.current?.click();
      return;
    }
    if (!selectedModel?.supportsEndFrame) {
      data.update(id, { error: "当前模型不支持尾帧图片。" });
      return;
    }
    endFramePicker.current?.click();
  };
  const selectModel = (modelId: string) => {
    const model = getModelDefinition(modelId);
    if (model.kind === "video") {
      const normalized = sanitizeVideoOptionsForModel(modelId, {
        mode: data.videoMode,
        aspectRatio: data.ratio,
        resolution: data.quality,
        duration: data.duration,
        hasStartFrame: Boolean(data.startFrameUrl),
        hasEndFrame: Boolean(data.endFrameUrl),
        hasImageInput: Boolean(data.referenceFrameUrls?.length || data.hasImageInput),
      });
      data.update(id, {
        model: modelId,
        videoMode: normalized.mode,
        ratio: normalized.aspectRatio,
        quality: normalized.resolution,
        duration: normalized.duration,
        settingsOpen: false,
        error: "",
      });
    } else {
      const normalized = normalizeModelOptions(modelId, { ratio: data.ratio, resolution: data.quality, duration: data.duration });
      data.update(id, { model: modelId, ratio: normalized.ratio, quality: normalized.resolution, duration: normalized.duration, settingsOpen: false, error: "" });
    }
    setModelOpen(false);
  };
  const updateMediaLayout = (width: number, height: number) => {
    setMediaLayout(getAdaptiveMediaLayout(width, height));
  };

  useEffect(() => {
    if (!mediaLayout) return;
    updateNodeInternals(id);
  }, [id, mediaLayout, updateNodeInternals]);

  if (data.kind === "group") {
    return (
      <article className="canvas-node group">
        <Handle type="target" position={Position.Left} className="port left" />
        <div className="group-node-title"><Icon name="grid" /><span>{data.title}</span></div>
        <div className="group-node-hint">拖动组可移动全部成员</div>
        <Handle type="source" position={Position.Right} className="port right" />
      </article>
    );
  }

  return (
    <article
      className={`canvas-node glass ${data.kind} ${textLengthClass} ${data.url ? "has-media" : ""} ${data.selectionSuppressed ? "selection-suppressed" : ""}`}
      style={mediaLayout ? ({ width: `${mediaLayout.width}px`, "--media-aspect": mediaLayout.aspectRatio } as CSSProperties) : undefined}
    >
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
            <video src={data.url} controls onLoadedMetadata={(event) => updateMediaLayout(event.currentTarget.videoWidth, event.currentTarget.videoHeight)} />
          ) : (
            <img src={data.url} alt={data.title} onLoad={(event) => updateMediaLayout(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)} />
          )
        ) : data.error ? (
          <div className="node-error-card">
            <Icon name={meta.icon} />
            <span>生成失败</span>
            <p>{data.error}</p>
          </div>
        ) : data.busy && data.kind === "video" ? (
          <div className="node-result-card video-generating">
            <Icon name={meta.icon} />
            <p className="text-result" onWheel={(event) => event.stopPropagation()}>{data.result || "生成中"}</p>
          </div>
        ) : data.result ? (
          <div className="node-result-card">
            <p className="text-result" onWheel={(event) => event.stopPropagation()}>{data.result}</p>
            {data.canResume && data.kind === "video" && (
              <div className="node-resume-section">
                <button className="resume-button" onClick={() => data.generate(id)}>
                  继续查询结果
                </button>
                <div className="node-debug">
                  {data.taskId && <span><b>taskId:</b> {data.taskId}</span>}
                  {data.lastProviderStatus && <span><b>上游状态:</b> {data.lastProviderStatus}</span>}
                  <span><b>状态:</b> timeout</span>
                  <span><b>错误:</b> AGNES_VIDEO_TIMEOUT</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="node-blank">
            <Icon name={meta.icon} />
            <span>{isMedia ? "上传或拖入素材" : "等待生成"}</span>
          </div>
        )}
      </div>
      {!isMedia && (
        <div className="prompt-pop nodrag" onMouseDown={(event) => event.stopPropagation()}>
          {(data.kind === "image" || data.kind === "video") && (
            <div className="frame-strip">
              <span className={`prompt-tool-square ${data.kind === "video" ? "motion-trigger-pill" : ""}`} onClick={() => { if (data.kind === "video") setMotionOpen(!motionOpen); else startFramePicker.current?.click(); }} style={{ cursor: "pointer" }}>
                <Icon name="camera" />
                {data.kind === "video" && <b>{MOTION_PRESETS.find((motion) => motion.id === (data.motionPreset ?? "auto"))?.label ?? "自动镜头"}</b>}
              </span>
              {motionOpen && (
                <div className="motion-popover glass">
                  <header><b>镜头运动</b><button onClick={() => setMotionOpen(false)}><Icon name="close" /></button></header>
                  <div className="motion-options">
                    {MOTION_PRESETS.map((motion) => (
                      <button
                        key={motion.id}
                        className={(data.motionPreset ?? "auto") === motion.id ? "selected" : ""}
                        onClick={() => { data.update(id, { motionPreset: motion.id }); setMotionOpen(false); }}
                      >
                        {motion.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {data.kind === "video" && frameMode !== "reference" && frameMode !== "text" && (
                <>
                  <div className="frame-slot start-frame-slot">
                    <button type="button" className={`frame-chip ${data.startFrameUrl ? "filled" : ""}`} onClick={() => startFramePicker.current?.click()} aria-label="首帧">
                      {data.startFrameUrl ? <img src={data.startFrameUrl} alt="" /> : <Icon name="image" />}
                      <span className="frame-tooltip">首帧</span>
                    </button>
                    {data.startFrameUrl && (
                      <button type="button" className="frame-remove" aria-label="删除首帧图片" onClick={(event) => { event.stopPropagation(); removeFrame("start"); }}>
                        <Icon name="close" />
                      </button>
                    )}
                  </div>
                  {frameMode === "first-last" && videoCapabilities?.supportsFirstLastFrame && (
                    <div className="frame-slot end-frame-slot">
                      <button type="button" className={`frame-chip ${data.endFrameUrl ? "filled" : ""}`} onClick={() => endFramePicker.current?.click()} aria-label="尾帧">
                        {data.endFrameUrl ? <img src={data.endFrameUrl} alt="" /> : <Icon name="image" />}
                        <span className="frame-tooltip">尾帧</span>
                      </button>
                      {data.endFrameUrl && (
                        <button type="button" className="frame-remove" aria-label="删除尾帧图片" onClick={(event) => { event.stopPropagation(); removeFrame("end"); }}>
                          <Icon name="close" />
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
              {data.kind === "video" && frameMode === "reference" && videoCapabilities?.supportsReferenceImages && (
                <div className="reference-frame-grid">
                  {referenceFrameUrls.map((url, index) => (
                    <div className="frame-slot reference-frame-slot" key={`${url}-${index}`}>
                      <button type="button" className="frame-chip filled" onClick={() => referenceFramePicker.current?.click()} aria-label={`参考图 ${index + 1}`}>
                        <img src={url} alt="" />
                        <span className="frame-tooltip">参考</span>
                      </button>
                      <button type="button" className="frame-remove" aria-label="删除参考图" onClick={(event) => { event.stopPropagation(); removeReferenceFrame(index); }}>
                        <Icon name="close" />
                      </button>
                    </div>
                  ))}
                  {canAddReferenceFrame && (
                    <button type="button" className="frame-add reference-frame-add" aria-label="添加参考图" onClick={() => referenceFramePicker.current?.click()}>
                      <Icon name="plus" />
                      <span className="frame-tooltip">参考</span>
                    </button>
                  )}
                </div>
              )}
              {data.kind === "image" && data.startFrameUrl && (
                <div className="frame-chip-wrap">
                  <button type="button" className="frame-chip filled" onClick={() => startFramePicker.current?.click()}>
                    <img src={data.startFrameUrl} alt="" />
                    <span className="frame-tooltip">首帧</span>
                  </button>
                  <button type="button" className="frame-remove" aria-label="删除首帧图片" onClick={(event) => { event.stopPropagation(); removeFrame("start"); }}>
                    <Icon name="close" />
                  </button>
                </div>
              )}
              {data.kind === "image" && (
                <button type="button" className="frame-add" aria-label="添加参考图片" onClick={openNextFramePicker}>
                  <Icon name="plus" />
                  <span className="frame-tooltip">首帧</span>
                </button>
              )}
              <input ref={startFramePicker} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
                importFrame("start", event.target.files?.[0]);
                event.target.value = "";
              }} />
              <input ref={endFramePicker} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
                importFrame("end", event.target.files?.[0]);
                event.target.value = "";
              }} />
              <input ref={referenceFramePicker} hidden type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => {
                void importReferenceFrames(Array.from(event.target.files ?? []));
                event.target.value = "";
              }} />
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
            {selectedModel && (
              <div className={`model-picker ${modelOpen ? "open" : ""}`}>
                <button type="button" className="model-trigger model-trigger-logo" aria-label={selectedModel.label} title={selectedModel.label} onClick={(event) => { event.stopPropagation(); setModelOpen((open) => !open); data.update(id, { settingsOpen: false }); }}>
                  <ModelLogoMark model={selectedModel} />
                  <span>{selectedModel.label}</span>
                </button>
                {modelOpen && (
                  <div className="model-menu">
                    {availableModels.map((model) => <button type="button" key={model.id} className={selectedModel.id === model.id ? "selected" : ""} onClick={(event) => { event.stopPropagation(); selectModel(model.id); }}>
                      <ModelLogoMark model={model} />
                      <span><b>{model.label}</b><small>{modelCapabilityLabel(model)}</small></span>
                      <em>{model.free ? "Free" : model.id === selectedModel.id ? "✓" : ""}</em>
                    </button>)}
                  </div>
                )}
              </div>
            )}
            {selectedModel && (
              <div className={`settings-details ${data.settingsOpen ? "open" : ""}`}>
                <button type="button" className="settings-trigger" onClick={(event) => { event.stopPropagation(); setModelOpen(false); data.update(id, { settingsOpen: !data.settingsOpen }); }}>
                  <i className={`ratio-shape ratio-${data.ratio.replace(":", "-")}`} />
                  <span className={data.kind === "video" ? "video-settings-summary" : ""}>
                    {data.kind === "video" ? videoSettingsSummary : `${data.ratio} · ${qualityLabel(data.quality)}`}
                  </span>
                </button>
                {data.settingsOpen && (
                  data.kind === "video" && videoCapabilities && videoOptions ? (
                    <div className="node-options video-node-options">
                      <div className="option-block">
                        <span>生成方式</span>
                        <div className="video-mode-options">
                          {videoCapabilities.supportedModes.filter((mode) => mode !== "text").map((mode) => (
                            <button key={mode} className={videoOptions.mode === mode ? "selected" : ""} onClick={(event) => { event.stopPropagation(); data.update(id, { videoMode: mode }); }}>{videoModeLabels[mode]}</button>
                          ))}
                        </div>
                      </div>
                      <div className="option-block">
                        <span>比例</span>
                        <div className="ratio-options video-ratio-options">
                          {videoCapabilities.aspectRatios.map((ratio) => (
                            <button key={ratio} className={videoOptions.aspectRatio === ratio ? "selected" : ""} onClick={(event) => { event.stopPropagation(); data.update(id, { ratio }); }}>
                              <i className={`ratio-shape ratio-${ratio.replace(":", "-")}`} /><em>{ratio}</em>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="option-block">
                        <span>清晰度</span>
                        <div className="quality-options">
                          {videoCapabilities.resolutions.map((quality) => (
                            <button key={quality} className={videoOptions.resolution === quality ? "selected" : ""} onClick={(event) => { event.stopPropagation(); data.update(id, { quality }); }}>{qualityLabel(quality)}</button>
                          ))}
                        </div>
                      </div>
                      <div className="option-block">
                        <span>生成时长</span>
                        <div className="quality-options duration-options">
                          {videoCapabilities.durations.map((duration) => (
                            <button key={duration} className={videoOptions.duration === duration ? "selected" : ""} onClick={(event) => { event.stopPropagation(); data.update(id, { duration }); }}>{duration}s</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="node-options">
                      <div className="option-block">
                        <span>画质与分辨率</span>
                        <div className="quality-options">
                          {qualityOptions.map((quality) => {
                            const supported = selectedModel.resolutions.includes(quality);
                            return <button key={quality} disabled={!supported} title={supported ? undefined : `${selectedModel.label} 不支持 ${qualityLabel(quality)}`} className={data.quality === quality ? "selected" : ""} onClick={(event) => { event.stopPropagation(); if (supported) data.update(id, { quality }); }}>{qualityLabel(quality)}</button>;
                          })}
                        </div>
                      </div>
                      <div className="option-block">
                        <span>比例</span>
                        <div className="ratio-options">
                          {RATIOS.map((ratio) => {
                            const supported = selectedModel.ratios.includes(ratio);
                            return <button key={ratio} disabled={!supported} title={supported ? undefined : `${selectedModel.label} 不支持 ${ratio}`} className={data.ratio === ratio ? "selected" : ""} onClick={(event) => { event.stopPropagation(); if (supported) data.update(id, { ratio }); }}>
                              <i className={`ratio-shape ratio-${ratio.replace(":", "-")}`} /><em>{ratio}</em>
                            </button>;
                          })}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
            {data.kind === "video" && selectedModel?.supportsNegativePrompt && (
              <div className={`negative-prompt-details ${data.negativePromptOpen ? "open" : ""}`}>
                <button type="button" className="negative-prompt-trigger" onClick={(event) => { event.stopPropagation(); data.update(id, { negativePromptOpen: !data.negativePromptOpen }); }}>
                  反向提示词
                </button>
                {data.negativePromptOpen && (
                  <div className="negative-prompt-dialog glass">
                    <textarea
                      className="negative-prompt-input"
                      value={data.negativePrompt ?? ""}
                      onChange={(event) => data.update(id, { negativePrompt: event.target.value })}
                      placeholder="描述不想在视频中出现的元素，如：模糊、低质量、扭曲、文字、水印..."
                    />
                  </div>
                )}
              </div>
            )}
            {selectedModel && <span className={`generation-cost ${selectedModel.free ? "free" : ""}`}>{selectedModel.free ? "Free" : `预计 ${estimatedCredits.toFixed(2).replace(/\.00$/, "")} 积分`}</span>}
            <button className="generate-button-submit" aria-label={data.busy ? "打断生成" : "生成"} title={data.busy ? "打断生成" : "生成"} onClick={() => data.generate(id)}>
              <span className="submit-credit-mark"><Icon name={data.busy ? "stop" : "spark"} /></span>
              {selectedModel && <span className={`generation-cost ${selectedModel.free ? "free" : ""}`}>{selectedModel.free ? "Free" : estimatedCredits.toFixed(2).replace(/\.00$/, "")}</span>}
              <span className="submit-arrow"><Icon name={data.busy ? "stop" : "arrow-up"} /></span>
            </button>
          </div>
        </div>
      )}
      <Handle type="source" position={Position.Right} className="port right" />
    </article>
  );
}

function areWorkNodePropsEqual(prev: NodeProps<WorkNode>, next: NodeProps<WorkNode>): boolean {
  if (prev.id !== next.id) return false;
  const a = prev.data;
  const b = next.data;
  return (
    a.kind === b.kind &&
    a.title === b.title &&
    a.prompt === b.prompt &&
    a.ratio === b.ratio &&
    a.quality === b.quality &&
    a.model === b.model &&
    a.videoMode === b.videoMode &&
    a.motionPreset === b.motionPreset &&
    a.duration === b.duration &&
    a.settingsOpen === b.settingsOpen &&
    a.negativePrompt === b.negativePrompt &&
    a.negativePromptOpen === b.negativePromptOpen &&
    a.url === b.url &&
    a.startFrameUrl === b.startFrameUrl &&
    a.startFrameName === b.startFrameName &&
    a.endFrameUrl === b.endFrameUrl &&
    a.endFrameName === b.endFrameName &&
    a.referenceFrameUrls === b.referenceFrameUrls &&
    a.referenceFrameNames === b.referenceFrameNames &&
    a.result === b.result &&
    a.taskId === b.taskId &&
    a.busy === b.busy &&
    a.error === b.error &&
    a.canResume === b.canResume &&
    a.lastProviderStatus === b.lastProviderStatus &&
    a.selectionSuppressed === b.selectionSuppressed &&
    a.hasImageInput === b.hasImageInput &&
    a.actualCredits === b.actualCredits
  );
}

const MemoizedWorkflowNode = memo(WorkflowNode, areWorkNodePropsEqual);

export const nodeTypes = { work: MemoizedWorkflowNode };
