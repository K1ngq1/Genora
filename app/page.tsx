"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addEdge, Background, BackgroundVariant, Controls, Handle, Panel, Position, ReactFlow, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow, type Connection, type Edge, type Node, type NodeProps } from "@xyflow/react";

type Kind = "text" | "image" | "video" | "media-image" | "media-video";
type Ratio = "1:1" | "4:3" | "3:4" | "16:9" | "9:16";
type Quality = "720p" | "1k" | "2k" | "4k";
type IconName = "text" | "image" | "video" | "spark" | "plus" | "close" | "upload" | "history";
type WorkData = { [key: string]: unknown; kind: Kind; title: string; prompt: string; ratio: Ratio; quality: Quality; duration: number; settingsOpen?: boolean; url?: string; result?: string; busy?: boolean; error?: string; update: (id: string, patch: Partial<WorkData>) => void; remove: (id: string) => void; generate: (id: string) => void };
type WorkNode = Node<WorkData, "work">;
type MenuState = { screen?: { x: number; y: number }; flow?: { x: number; y: number }; x?: number; y?: number };

const RATIOS: Ratio[] = ["1:1", "4:3", "3:4", "16:9", "9:16"];
const QUALITIES: Quality[] = ["720p", "1k", "2k", "4k"];
const LONG_EDGE: Record<Quality, number> = { "720p": 720, "1k": 1024, "2k": 2048, "4k": 3840 };
const IMAGE_API_QUALITY: Record<Quality, "low" | "medium" | "high"> = { "720p": "low", "1k": "medium", "2k": "high", "4k": "high" };
const KIND_META: Record<Kind, { title: string; subtitle: string; icon: IconName }> = {
  text: { title: "文本", subtitle: "GPT-5.5", icon: "text" },
  image: { title: "图像", subtitle: "GPT Image 2", icon: "image" },
  video: { title: "视频", subtitle: "Agnes Video 2.0", icon: "video" },
  "media-image": { title: "图片素材", subtitle: "本地输入", icon: "image" },
  "media-video": { title: "视频素材", subtitle: "本地输入", icon: "video" },
};

function dimensions(ratio: Ratio, quality: Quality): [number, number] {
  const long = LONG_EDGE[quality];
  const sizes: Record<Ratio, [number, number]> = { "1:1": [long, long], "4:3": [long, long * .75], "3:4": [long * .75, long], "16:9": [long, long * 9 / 16], "9:16": [long * 9 / 16, long] };
  return sizes[ratio].map((value) => Math.max(16, Math.round(value / 16) * 16)) as [number, number];
}
function imageSize(ratio: Ratio, quality: Quality) {
  let [width, height] = dimensions(ratio, quality); const maxPixels = 8_294_400;
  if (width * height > maxPixels) { const scale = Math.sqrt(maxPixels / (width * height)); width = Math.floor(width * scale / 16) * 16; height = Math.floor(height * scale / 16) * 16; }
  return `${width}x${height}`;
}
function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    text: <path d="M5 6V4h14v2M12 4v16m-4 0h8" />, image: <><rect width="18" height="16" x="3" y="4" rx="3" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></>,
    video: <><rect width="14" height="12" x="3" y="6" rx="3" /><path d="m17 10 4-2v8l-4-2" /></>, spark: <path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8Z" />,
    plus: <path d="M12 5v14m-7-7h14" />, close: <path d="M18 6 6 18M6 6l12 12" />, upload: <><path d="M12 16V4m0 0L8 8m4-4 4 4" /><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></>, history: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5M12 7v5l3 2" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function WorkflowNode({ id, data }: NodeProps<WorkNode>) {
  const picker = useRef<HTMLInputElement>(null); const meta = KIND_META[data.kind]; const isMedia = data.kind.startsWith("media-");
  const importMedia = (file?: File) => { if (file) data.update(id, { kind: file.type.startsWith("video/") ? "media-video" : "media-image", title: file.name, url: URL.createObjectURL(file), result: undefined, error: "" }); };
  return <article className={`canvas-node glass ${data.kind}`}>
    <Handle type="target" position={Position.Left} className="port left" />
    <button className="node-upload nodrag" onClick={() => picker.current?.click()}><Icon name="upload" />上传</button>
    <header><span><Icon name={meta.icon} />{data.title}</span><button aria-label="删除节点" onClick={() => data.remove(id)}><Icon name="close" /></button></header>
    <input ref={picker} hidden type="file" accept="image/*,video/*" onChange={(event) => importMedia(event.target.files?.[0])} />
    {data.url ? data.kind.includes("video") ? <video src={data.url} controls /> : <img src={data.url} alt={data.title} /> : data.result ? <p className="text-result">{data.result}</p> : <div className="node-blank"><Icon name={meta.icon} /><span>{isMedia ? "上传或拖入素材" : "等待生成"}</span></div>}
    {!isMedia && <div className="prompt-pop nodrag" onMouseDown={(event) => event.stopPropagation()}>
      <textarea className="prompt-input" value={data.prompt} onChange={(event) => data.update(id, { prompt: event.target.value })} placeholder="填写提示词，描述你想生成的内容..." />
      <div className="prompt-toolbar">
        <div className={`settings-details ${data.settingsOpen ? "open" : ""}`}>
          <button type="button" className="settings-trigger" onClick={(event) => { event.stopPropagation(); data.update(id, { settingsOpen: !data.settingsOpen }); }}><i className={`ratio-shape ratio-${data.ratio.replace(":", "-")}`} />{data.ratio} · {data.quality.toUpperCase()}</button>
          {data.settingsOpen && <div className="node-options">
            <div className="option-block"><span>画质</span><div className="quality-options">{QUALITIES.map((quality) => <button key={quality} className={data.quality === quality ? "selected" : ""} onClick={(event) => { event.stopPropagation(); data.update(id, { quality }); }}>{quality.toUpperCase()}</button>)}</div></div>
            {data.kind === "video" && data.quality === "4k" && <small className="quality-warning">4K 视频生成负载较高，可能需要更长排队时间。遇到上游繁忙时系统会自动重试。</small>}
            <div className="option-block"><span>比例</span><div className="ratio-options">{RATIOS.map((ratio) => <button key={ratio} className={data.ratio === ratio ? "selected" : ""} onClick={(event) => { event.stopPropagation(); data.update(id, { ratio }); }}><i className={`ratio-shape ratio-${ratio.replace(":", "-")}`} /><em>{ratio}</em></button>)}</div></div>
            {data.kind === "video" && <div className="option-block duration-block"><span>生成时长 <b>{data.duration} 秒</b></span><input type="range" min="3" max="10" step="1" value={data.duration} onChange={(event) => data.update(id, { duration: Number(event.target.value) })} /><div><small>3 秒</small><small>10 秒</small></div></div>}
          </div>}
        </div>
        {data.kind === "video" && <span>{data.duration} 秒</span>}
        <button className="generate-button" disabled={data.busy} onClick={() => data.generate(id)}><Icon name="spark" />{data.busy ? "生成中" : "生成"}</button>
      </div>
      {data.error && <p>{data.error}</p>}
    </div>}<Handle type="source" position={Position.Right} className="port right" />
  </article>;
}
const nodeTypes = { work: WorkflowNode };

function WorkflowCanvas() {
  const reactFlow = useReactFlow(); const [nodes, setNodes, onNodesChange] = useNodesState<WorkNode>([]); const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]); const [menu, setMenu] = useState<MenuState>();
  const [config, setConfig] = useState({ openaiConfigured: true, agnesConfigured: true }); const nodesRef = useRef(nodes); const edgesRef = useRef(edges); const configRef = useRef(config); const imagePicker = useRef<HTMLInputElement>(null); const videoPicker = useRef<HTMLInputElement>(null);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]); useEffect(() => { edgesRef.current = edges; }, [edges]); useEffect(() => { configRef.current = config; }, [config]); useEffect(() => { fetch("/api/config").then((response) => response.json()).then(setConfig).catch(() => undefined); }, []);
  const update = useCallback((id: string, patch: Partial<WorkData>) => setNodes((current) => current.map((node) => node.id === id ? { ...node, data: { ...node.data, ...patch } } : node)), [setNodes]);
  const remove = useCallback((id: string) => { setNodes((current) => current.filter((node) => node.id !== id)); setEdges((current) => current.filter((edge) => edge.source !== id && edge.target !== id)); }, [setEdges, setNodes]);
  const generate = useCallback(async (id: string) => {
    const node = nodesRef.current.find((item) => item.id === id); if (!node) return;
    const upstream = edgesRef.current.filter((edge) => edge.target === id).map((edge) => nodesRef.current.find((item) => item.id === edge.source)).filter((item): item is WorkNode => Boolean(item));
    const prompt = [upstream.map((item) => item.data.result || item.data.prompt).filter(Boolean).join("\n\n"), node.data.prompt].filter(Boolean).join("\n\n");
    if (!prompt.trim()) return update(id, { error: "请填写提示词，或连接包含内容的上游节点。" });
    if ((node.data.kind === "text" || node.data.kind === "image") && !configRef.current.openaiConfigured) return update(id, { error: "请先在 .env 中配置 OPENAI_API_KEY。" }); if (node.data.kind === "video" && !configRef.current.agnesConfigured) return update(id, { error: "请先在 .env 中配置 AGNES_API_KEY。" }); update(id, { busy: true, error: "" });
    try {
      let response: Response;
      if (node.data.kind === "text") response = await fetch("/api/text/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      else if (node.data.kind === "image") response = await fetch("/api/images/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, size: imageSize(node.data.ratio, node.data.quality), quality: IMAGE_API_QUALITY[node.data.quality] }) });
      else { const [width, height] = dimensions(node.data.ratio, node.data.quality); const form = new FormData(); form.set("prompt", prompt); form.set("width", String(width)); form.set("height", String(height)); form.set("frames", String(node.data.duration * 16 + 1)); form.set("frameRate", "16"); const source = upstream.find((item) => item.data.url && item.data.kind === "media-image"); if (source?.data.url) form.set("image", await fetch(source.data.url).then((result) => result.blob()), "connected-image.png"); response = await fetch("/api/videos/generate", { method: "POST", body: form }); }
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "生成失败"); update(id, { busy: false, result: body.text, url: body.outputUrl, error: body.status === "processing" ? "视频任务已提交，可在作品库查看进度。" : "" });
    } catch (error) { update(id, { busy: false, error: error instanceof Error ? error.message : "生成失败" }); }
  }, [update]);
  const addNode = useCallback((kind: Kind, position?: { x: number; y: number }, file?: File) => { const point = position ?? reactFlow.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }); const id = crypto.randomUUID(); setNodes((current) => [...current, { id, type: "work", position: { x: point.x - 140, y: point.y - 70 }, data: { kind, title: file?.name ?? KIND_META[kind].title, prompt: "", ratio: "1:1", quality: "2k", duration: 5, url: file ? URL.createObjectURL(file) : undefined, update, remove, generate } }]); setMenu(undefined); }, [generate, reactFlow, remove, setNodes, update]);
  const onConnect = useCallback((connection: Connection) => setEdges((current) => addEdge({ ...connection, animated: true }, current)), [setEdges]);
  const onDrop = useCallback((event: React.DragEvent) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (!file) return; const position = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY }); if (file.type.startsWith("image/")) addNode("media-image", position, file); if (file.type.startsWith("video/")) addNode("media-video", position, file); }, [addNode, reactFlow]);
  const openMenu = useCallback((x: number, y: number) => setMenu({ screen: { x, y }, flow: reactFlow.screenToFlowPosition({ x, y }) }), [reactFlow]);
  const menuScreen = menu?.screen ?? { x: menu?.x ?? 0, y: menu?.y ?? 0 }; const menuFlow = menu?.flow ?? menuScreen;
  return <main className="canvas-shell"><header className="topbar glass"><div className="brand"><img src="/assets/liquid-orb.png" alt="" /><b>Agnes Canvas</b><em>∞</em></div><div className="top-title"><i className="status-dot" /><span>Untitled Space</span><small>已自动保存</small></div><button className="glass-pill"><Icon name="history" />作品库</button></header>
    <input ref={imagePicker} hidden type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && addNode("media-image", undefined, event.target.files[0])} /><input ref={videoPicker} hidden type="file" accept="video/*" onChange={(event) => event.target.files?.[0] && addNode("media-video", undefined, event.target.files[0])} />
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onDrop={onDrop} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDoubleClick={(event) => { if (!(event.target as HTMLElement).closest(".react-flow__node")) openMenu(event.clientX, event.clientY); }} onPaneClick={() => setMenu(undefined)} zoomOnDoubleClick={false} fitView fitViewOptions={{ maxZoom: 1 }} minZoom={.25} maxZoom={2} colorMode="dark" defaultEdgeOptions={{ animated: true }} proOptions={{ hideAttribution: true }}>
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#ffffff24" /><Controls position="bottom-center" showInteractive={false} />
      <Panel position="top-left" className="sidebar glass"><button className="sidebar-add" title="添加节点" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); openMenu(rect.right + 24, rect.top + 18); }}><Icon name="plus" /></button><button title="文本" onClick={() => addNode("text")}><Icon name="text" /></button><button title="图像" onClick={() => addNode("image")}><Icon name="image" /></button><button title="视频" onClick={() => addNode("video")}><Icon name="video" /></button></Panel>{nodes.length === 0 && <Panel position="top-center" className="empty-canvas"><Icon name="plus" /><b>双击画布开始创作</b><span>添加文字、图片或视频生成节点</span></Panel>}
    </ReactFlow>{menu && <div className="node-menu glass" style={{ left: menuScreen.x, top: menuScreen.y }}><header><b>添加节点</b><button onClick={() => setMenu(undefined)}><Icon name="close" /></button></header><button onClick={() => addNode("image", menuFlow)}><Icon name="image" /><span><b>图像</b><em>GPT Image 2</em></span><Icon name="plus" /></button><button onClick={() => addNode("video", menuFlow)}><Icon name="video" /><span><b>视频</b><em>文本或图片 + 提示词</em></span><Icon name="plus" /></button><button onClick={() => addNode("text", menuFlow)}><Icon name="text" /><span><b>文本</b><em>GPT-5.5</em></span><Icon name="plus" /></button><hr /><button onClick={() => imagePicker.current?.click()}><Icon name="upload" /><span><b>上传图片</b><em>添加本地素材</em></span></button><button onClick={() => videoPicker.current?.click()}><Icon name="upload" /><span><b>上传视频</b><em>添加参考素材</em></span></button></div>}
  </main>;
}
export default function Home() { return <ReactFlowProvider><WorkflowCanvas /></ReactFlowProvider>; }
