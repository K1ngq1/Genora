import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from "@xyflow/react";
import { estimateCredits, getModelDefinition, modelCapabilityLabel, modelsForKind, normalizeModelOptions } from "@/lib/model-catalog";
import { getAdaptiveMediaLayout, type AdaptiveMediaLayout } from "@/lib/node-media-layout";
import { KIND_META, MOTION_PRESETS, RATIOS, VIDEO_QUALITIES } from "./workspace-constants";
import { qualityLabel } from "./workspace-utils";
import { Icon } from "./workspace-icon";
import type { WorkNode } from "./workspace-types";

function WorkflowNode({ id, data }: NodeProps<WorkNode>) {
  const picker = useRef<HTMLInputElement>(null);
  const startFramePicker = useRef<HTMLInputElement>(null);
  const endFramePicker = useRef<HTMLInputElement>(null);
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
  const estimatedCredits = selectedModel ? estimateCredits({
    model: selectedModel.id,
    resolution: data.quality,
    duration: data.duration,
    hasImageInput: Boolean(data.startFrameUrl || data.endFrameUrl || data.hasImageInput),
  }) : 0;
  const promptHeight = Math.min(260, Math.max(96, 78 + data.prompt.length / 3 + data.prompt.split("\n").length * 20));
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
  const removeFrame = (slot: "start" | "end") => {
    data.update(id, slot === "start"
      ? { startFrameUrl: undefined, startFrameName: undefined }
      : { endFrameUrl: undefined, endFrameName: undefined });
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
    const normalized = normalizeModelOptions(modelId, { ratio: data.ratio, resolution: data.quality, duration: data.duration });
    data.update(id, { model: modelId, ratio: normalized.ratio, quality: normalized.resolution, duration: normalized.duration, settingsOpen: false, error: "" });
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
      className={`canvas-node glass ${data.kind} ${data.url ? "has-media" : ""} ${data.selectionSuppressed ? "selection-suppressed" : ""}`}
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
            <p className="text-result">{data.result || "生成中"}</p>
          </div>
        ) : data.result ? (
          <div className="node-result-card">
            <p className="text-result">{data.result}</p>
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
              <span className="prompt-tool-square" onClick={() => { if (data.kind === "video") setMotionOpen(!motionOpen); else startFramePicker.current?.click(); }} style={{ cursor: "pointer" }}>
                <Icon name="camera" />
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
              {data.kind === "video" && (
                <>
                  <div className="frame-slot start-frame-slot">
                    <button type="button" className={`frame-chip ${data.startFrameUrl ? "filled" : ""}`} onClick={() => startFramePicker.current?.click()}>
                      {data.startFrameUrl ? <img src={data.startFrameUrl} alt="首帧" /> : <Icon name="image" />}
                      <b>首帧</b>
                    </button>
                    {data.startFrameUrl && (
                      <button type="button" className="frame-remove" aria-label="删除首帧图片" onClick={(event) => { event.stopPropagation(); removeFrame("start"); }}>
                        <Icon name="close" />
                      </button>
                    )}
                  </div>
                  {selectedModel?.supportsEndFrame && (
                    <div className="frame-slot end-frame-slot">
                      <button type="button" className={`frame-chip ${data.endFrameUrl ? "filled" : ""}`} onClick={() => endFramePicker.current?.click()}>
                        {data.endFrameUrl ? <img src={data.endFrameUrl} alt="尾帧" /> : <Icon name="image" />}
                        <b>尾帧</b>
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
              {data.startFrameUrl && (
                <div className="frame-chip-wrap">
                  <button type="button" className="frame-chip filled" onClick={() => startFramePicker.current?.click()}>
                    <img src={data.startFrameUrl} alt="首帧" />
                    <span>首帧</span>
                  </button>
                  <button type="button" className="frame-remove" aria-label="删除首帧图片" onClick={(event) => { event.stopPropagation(); removeFrame("start"); }}>
                    <Icon name="close" />
                  </button>
                </div>
              )}
              {data.endFrameUrl && (
                <div className="frame-chip-wrap">
                  <button type="button" className="frame-chip filled" onClick={() => endFramePicker.current?.click()}>
                    <img src={data.endFrameUrl} alt="尾帧" />
                    <span>尾帧</span>
                  </button>
                  <button type="button" className="frame-remove" aria-label="删除尾帧图片" onClick={(event) => { event.stopPropagation(); removeFrame("end"); }}>
                    <Icon name="close" />
                  </button>
                </div>
              )}
              <button type="button" className="frame-add" aria-label="添加参考图片" onClick={openNextFramePicker}>
                <Icon name="plus" />
              </button>
              <input ref={startFramePicker} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
                importFrame("start", event.target.files?.[0]);
                event.target.value = "";
              }} />
              <input ref={endFramePicker} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
                importFrame("end", event.target.files?.[0]);
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
                  <Icon name={meta.icon} />
                  <span>{selectedModel.label}</span>
                </button>
                {modelOpen && (
                  <div className="model-menu">
                    {availableModels.map((model) => <button type="button" key={model.id} className={selectedModel.id === model.id ? "selected" : ""} onClick={(event) => { event.stopPropagation(); selectModel(model.id); }}>
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
                  {data.ratio} · {qualityLabel(data.quality)}
                </button>
                {data.settingsOpen && <div className="node-options">
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
                  {data.kind === "video" && <div className="option-block duration-block">
                    <span>生成时长 <b>{data.duration} 秒</b></span>
                    <input type="range" min={selectedModel.minDuration ?? 1} max={selectedModel.maxDuration ?? 18} step="1" value={data.duration} onChange={(event) => data.update(id, { duration: Number(event.target.value) })} />
                    <div><small>{selectedModel.minDuration ?? 1} 秒</small><small>按模型能力</small><small>{selectedModel.maxDuration ?? 18} 秒</small></div>
                  </div>}
                </div>}
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
            {data.kind === "video" && <span>{data.duration} 秒</span>}
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

export const nodeTypes = { work: WorkflowNode };
