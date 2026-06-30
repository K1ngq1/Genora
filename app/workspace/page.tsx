"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  addEdge,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useViewport,
  type Connection,
  type Edge,
  type OnConnectEnd,
} from "@xyflow/react";
import { VIDEO_POLL_INTERVAL_MS, VIDEO_POLL_MAX_ATTEMPTS } from "@/lib/video-polling";
import {
  getModelDefinition,
  normalizeModelOptions,
} from "@/lib/model-catalog";
import { sanitizeVideoOptionsForModel } from "@/lib/video-model-capabilities";
import { getVideoDimensions } from "@/lib/generation-quality";
import {
  AGENT_CANVAS_TOOLS,
  AGENT_TOOL_NAMES,
  KIND_META,
  MAX_VIDEO_FRAMES,
  MOTION_PRESETS,
  RATIOS,
  SAFE_VIDEO_MAX_FRAMES,
  SAFE_VIDEO_QUALITY,
  SUGGESTIONS,
  TEMP_USER_NAME,
  VIDEO_FRAME_RATE,
} from "@/features/workspace/workspace-constants";
import { appendImageFromUrl, fileToDataUrl, localUrlToDataUrl, materializeReferenceUrl } from "@/features/workspace/workspace-client-utils";
import { Icon } from "@/features/workspace/workspace-icon";
import { nodeTypes } from "@/features/workspace/workflow-node";
import {
  imageSize,
  localizeError,
  mapTaskToNodePatch,
  randomUuid,
  readJson,
  responseError,
  serializeWorkNode,
} from "@/features/workspace/workspace-utils";
import type {
  AgentAttachment,
  AgentMessage,
  AgentToolCall,
  CanvasClipboard,
  CanvasProject,
  DeletedCanvasEntry,
  Kind,
  LibraryMenuState,
  LibraryTreeItem,
  MaterialLibraryItem,
  MenuState,
  NodeContextMenuState,
  Ratio,
  SaveStatus,
  StoredWorkData,
  ThemeTone,
  WorkNode,
} from "@/features/workspace/workspace-types";

function nodeSize(node: WorkNode) {
  const style = node.style as { width?: number | string; height?: number | string } | undefined;
  const styleWidth = typeof style?.width === "number" ? style.width : Number.parseFloat(String(style?.width ?? ""));
  const styleHeight = typeof style?.height === "number" ? style.height : Number.parseFloat(String(style?.height ?? ""));
  return {
    width: node.measured?.width ?? (Number.isFinite(styleWidth) ? styleWidth : 340),
    height: node.measured?.height ?? (Number.isFinite(styleHeight) ? styleHeight : 220),
  };
}

function WorkflowCanvas() {
  const reactFlow = useReactFlow();
  const searchParams = useSearchParams();
  const requestedProjectId = searchParams.get("project");
  const launchPrompt = searchParams.get("prompt")?.trim() ?? "";
  const launchKind = searchParams.get("kind");
  const launchModel = searchParams.get("model")?.trim() ?? "";
  const viewport = useViewport();
  const { zoom } = viewport;
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [menu, setMenu] = useState<MenuState>();
  const [nodeContextMenu, setNodeContextMenu] = useState<NodeContextMenuState>();
  const [config, setConfig] = useState({ openaiConfigured: true, agnesConfigured: true, agnesPublicImageStorageConfigured: false, apimartImageConfigured: false, apimartVideoConfigured: false, apimartDevConfigured: false });
  const [agentOpen, setAgentOpen] = useState(false);
  const [orbOpen, setOrbOpen] = useState(false);
  const [homeMenuOpen, setHomeMenuOpen] = useState(false);
  const [miniMapOpen, setMiniMapOpen] = useState(false);
  const [materialLibraryOpen, setMaterialLibraryOpen] = useState(false);
  const [materialLibrary, setMaterialLibrary] = useState<MaterialLibraryItem[]>([]);
  const [activeLibraryFolderId, setActiveLibraryFolderId] = useState<string | null>(null);
  const [editingLibraryItemId, setEditingLibraryItemId] = useState<string | null>(null);
  const [editingLibraryName, setEditingLibraryName] = useState("");
  const [expandedLibraryFolderIds, setExpandedLibraryFolderIds] = useState<string[]>([]);
  const [libraryMenu, setLibraryMenu] = useState<LibraryMenuState | null>(null);
  const [gridVisible, setGridVisible] = useState(true);
  const [themeTone, setThemeTone] = useState<ThemeTone>("dark");
  const [accentColor, setAccentColor] = useState("#a996ff");
  const [fontScale, setFontScale] = useState(100);
  const [agentInput, setAgentInput] = useState("");
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [agentAttachments, setAgentAttachments] = useState<AgentAttachment[]>([]);
  const [agentCanUndo, setAgentCanUndo] = useState(false);
  const [suggestionOffset, setSuggestionOffset] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [project, setProject] = useState<CanvasProject>();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState("");
  const [, setCanUndoDelete] = useState(false);
  const agentHasConversation = agentMessages.length > 0 || agentBusy;
  const saveLabel = {
    loading: "正在加载项目",
    unsaved: "有未保存修改",
    saving: "正在保存",
    saved: "已保存",
    error: "保存失败，请按 Ctrl+S 重试",
  }[saveStatus];
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const configRef = useRef(config);
  const materialLibraryRef = useRef(materialLibrary);
  const interruptedRef = useRef(new Set<string>());
  const activePollingTasksRef = useRef(new Map<string, string>());
  const pollTimersRef = useRef(new Map<string, number>());
  const messagesRef = useRef(agentMessages);
  const attachmentsRef = useRef(agentAttachments);
  const projectRef = useRef(project);
  const projectLoadedRef = useRef(false);
  const dirtyRef = useRef(false);
  const deletedCanvasStackRef = useRef<DeletedCanvasEntry[]>([]);
  const canvasClipboardRef = useRef<CanvasClipboard | undefined>(undefined);
  const agentSnapshotRef = useRef<{ nodes: WorkNode[]; edges: Edge[] } | null>(null);
  const executedToolCallIdsRef = useRef<Set<string>>(new Set());
  const generateRef = useRef<(id: string) => void>(() => undefined);
  const uploadAssetRef = useRef<(file: File) => Promise<string>>(async () => { throw new Error("PROJECT_NOT_READY"); });
  const imagePicker = useRef<HTMLInputElement>(null);
  const videoPicker = useRef<HTMLInputElement>(null);
  const libraryPicker = useRef<HTMLInputElement>(null);
  const agentImagePicker = useRef<HTMLInputElement>(null);
  const agentVideoPicker = useRef<HTMLInputElement>(null);
  const visibleSuggestions = useMemo(() => [0, 1, 2].map((index) => SUGGESTIONS[(suggestionOffset + index) % SUGGESTIONS.length]), [suggestionOffset]);
  const activeLibraryFolder = useMemo(
    () => materialLibrary.find((item) => item.id === activeLibraryFolderId && item.kind === "folder"),
    [activeLibraryFolderId, materialLibrary],
  );
  const libraryTreeItems = useMemo(() => {
    const result: LibraryTreeItem[] = [];
    const children = new Map<string | null, MaterialLibraryItem[]>();
    materialLibrary.forEach((item) => {
      const key = item.folderId ?? null;
      children.set(key, [...(children.get(key) ?? []), item]);
    });
    const visit = (folderId: string | null, depth: number, seen = new Set<string>()) => {
      (children.get(folderId) ?? []).forEach((item) => {
        if (seen.has(item.id)) return;
        result.push({ item, depth });
        if (item.kind === "folder" && expandedLibraryFolderIds.includes(item.id)) {
          visit(item.id, depth + 1, new Set([...seen, item.id]));
        }
      });
    };
    visit(activeLibraryFolderId, 0);
    return result;
  }, [activeLibraryFolderId, expandedLibraryFolderIds, materialLibrary]);
  const materialFolders = useMemo(() => materialLibrary.filter((item) => item.kind === "folder"), [materialLibrary]);
  const libraryMenuItem = useMemo(
    () => libraryMenu ? materialLibrary.find((item) => item.id === libraryMenu.id) : undefined,
    [libraryMenu, materialLibrary],
  );
  const renderedNodes = useMemo(() => {
    const suppressPromptIds = new Set(selectedIds.length > 1 ? selectedIds : []);
    return nodes.map((node) => {
      const selectionSuppressed = suppressPromptIds.has(node.id);
      if (node.data.kind !== "image" && node.data.kind !== "video") {
        return selectionSuppressed ? { ...node, data: { ...node.data, selectionSuppressed } } : node;
      }
      const sourceIds = new Set(edges.filter((edge) => edge.target === node.id).map((edge) => edge.source));
      const hasImageInput = nodes.some((source) => sourceIds.has(source.id) && Boolean(source.data.url) && !source.data.kind.includes("video"));
      return { ...node, data: { ...node.data, hasImageInput, selectionSuppressed } };
    });
  }, [edges, nodes, selectedIds]);
  const selectionAction = useMemo(() => {
    const selected = nodes.filter((node) => selectedIds.includes(node.id));
    const group = selected.length === 1 && selected[0].data.kind === "group" ? selected[0] : undefined;
    const groupable = selected.filter((node) => !node.parentId && node.data.kind !== "group");
    const mode = group ? "ungroup" : groupable.length >= 2 ? "group" : undefined;
    const actionNodes = group ? [group] : groupable;
    if (!mode || !actionNodes.length) return undefined;
    const minX = Math.min(...actionNodes.map((node) => node.position.x));
    const minY = Math.min(...actionNodes.map((node) => node.position.y));
    const maxX = Math.max(...actionNodes.map((node) => node.position.x + nodeSize(node).width));
    const topCenter = reactFlow.flowToScreenPosition({ x: minX + (maxX - minX) / 2, y: minY });
    return {
      mode,
      groupId: group?.id,
      left: topCenter.x,
      top: Math.max(84, topCenter.y - 46),
    };
  }, [nodes, reactFlow, selectedIds, viewport.x, viewport.y, viewport.zoom]);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { materialLibraryRef.current = materialLibrary; }, [materialLibrary]);
  useEffect(() => { messagesRef.current = agentMessages; }, [agentMessages]);
  useEffect(() => { attachmentsRef.current = agentAttachments; }, [agentAttachments]);
  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { fetch("/api/config").then(readJson).then(setConfig).catch(() => undefined); }, []);
  useEffect(() => {
    if (agentOpen) setSuggestionOffset(Math.floor(Math.random() * SUGGESTIONS.length));
  }, [agentOpen]);
  const markUnsaved = useCallback(() => {
    if (!projectLoadedRef.current) return;
    dirtyRef.current = true;
    setSaveStatus("unsaved");
  }, []);
  const update = useCallback((id: string, patch: Partial<StoredWorkData>) => {
    markUnsaved();
    setNodes((current) => current.map((node) => node.id === id ? { ...node, data: { ...node.data, ...patch } } : node));
  }, [markUnsaved, setNodes]);
  const clearPollingTask = useCallback((nodeId: string, taskId?: string) => {
    const activeTaskId = activePollingTasksRef.current.get(nodeId);
    const targetTaskId = taskId ?? activeTaskId;
    if (targetTaskId) {
      const key = `${nodeId}:${targetTaskId}`;
      const timer = pollTimersRef.current.get(key);
      if (timer) window.clearTimeout(timer);
      pollTimersRef.current.delete(key);
    }
    if (!taskId || activeTaskId === taskId) activePollingTasksRef.current.delete(nodeId);
  }, []);
  const clearAllPollingTasks = useCallback(() => {
    for (const timer of pollTimersRef.current.values()) window.clearTimeout(timer);
    pollTimersRef.current.clear();
    activePollingTasksRef.current.clear();
  }, []);
  const deleteCanvasNodes = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    nodesRef.current.forEach((node) => {
      if (node.parentId && idSet.has(node.parentId)) idSet.add(node.id);
    });
    const deletedNodes = nodesRef.current.filter((node) => idSet.has(node.id));
    if (!deletedNodes.length) return;
    const deletedEdges = edgesRef.current.filter((edge) => idSet.has(edge.source) || idSet.has(edge.target));
    idSet.forEach((id) => clearPollingTask(id));
    deletedCanvasStackRef.current = [
      ...deletedCanvasStackRef.current.slice(-19),
      { nodes: deletedNodes, edges: deletedEdges },
    ];
    setCanUndoDelete(true);
    markUnsaved();
    setNodes((current) => current.filter((node) => !idSet.has(node.id)));
    setEdges((current) => current.filter((edge) => !idSet.has(edge.source) && !idSet.has(edge.target)));
    setSelectedIds([]);
  }, [clearPollingTask, markUnsaved, setEdges, setNodes]);
  const restoreDeletedCanvas = useCallback(() => {
    const entry = deletedCanvasStackRef.current.pop();
    if (!entry) return;
    markUnsaved();
    setNodes((current) => {
      const existingIds = new Set(current.map((node) => node.id));
      return [...current, ...entry.nodes.filter((node) => !existingIds.has(node.id))];
    });
    setEdges((current) => {
      const existingIds = new Set(current.map((edge) => edge.id));
      return [...current, ...entry.edges.filter((edge) => !existingIds.has(edge.id))];
    });
    setCanUndoDelete(deletedCanvasStackRef.current.length > 0);
  }, [markUnsaved, setEdges, setNodes]);
  const remove = useCallback((id: string) => deleteCanvasNodes([id]), [deleteCanvasNodes]);
  const clipboardNodeIds = useCallback((ids: string[]) => {
    const expanded = new Set(ids);
    nodesRef.current.forEach((node) => {
      if (node.parentId && expanded.has(node.parentId)) expanded.add(node.id);
    });
    return expanded;
  }, []);
  const copyCanvasSelection = useCallback((ids = selectedIds) => {
    if (!ids.length) return false;
    const idSet = clipboardNodeIds(ids);
    const copiedNodes = nodesRef.current
      .filter((node) => idSet.has(node.id))
      .map((node) => ({ ...serializeWorkNode(node), selected: false }));
    if (!copiedNodes.length) return false;
    canvasClipboardRef.current = {
      nodes: copiedNodes,
      edges: edgesRef.current.filter((edge) => idSet.has(edge.source) && idSet.has(edge.target)),
    };
    return true;
  }, [clipboardNodeIds, selectedIds]);
  const cutCanvasSelection = useCallback((ids = selectedIds) => {
    if (!copyCanvasSelection(ids)) return;
    deleteCanvasNodes([...clipboardNodeIds(ids)]);
    setNodeContextMenu(undefined);
  }, [clipboardNodeIds, copyCanvasSelection, deleteCanvasNodes, selectedIds]);
  const saveSelectionToLibrary = useCallback(() => {
    const ids = selectedIds.length ? selectedIds : nodesRef.current.filter((node) => node.selected).map((node) => node.id);
    if (!ids.length) return;
    const idSet = clipboardNodeIds(ids);
    const libraryNodes = nodesRef.current
      .filter((node) => idSet.has(node.id))
      .map((node) => ({ ...serializeWorkNode(node), selected: false }));
    if (!libraryNodes.length) return;
    const libraryEdges = edgesRef.current.filter((edge) => idSet.has(edge.source) && idSet.has(edge.target));
    const first = libraryNodes[0];
    const label = libraryNodes.length === 1 ? first.data.title : `${libraryNodes.length} 个节点`;
    const kind: MaterialLibraryItem["kind"] = libraryNodes.length > 1 || first.data.kind === "group"
      ? "group"
      : first.data.kind.includes("video")
        ? "video"
        : first.data.kind.includes("image")
          ? "image"
          : "node";
    const item: MaterialLibraryItem = {
      id: randomUuid(),
      name: label || "素材",
      kind,
      folderId: activeLibraryFolderId,
      url: libraryNodes.length === 1 ? first.data.url : undefined,
      nodes: libraryNodes,
      edges: libraryEdges,
      createdAt: new Date().toISOString(),
    };
    setMaterialLibrary((current) => [item, ...current].slice(0, 80));
    setMaterialLibraryOpen(true);
    markUnsaved();
    setNodeContextMenu(undefined);
  }, [activeLibraryFolderId, clipboardNodeIds, markUnsaved, selectedIds]);
  const pasteCanvasSelection = useCallback((position?: { x: number; y: number }) => {
    const snapshot = canvasClipboardRef.current;
    if (!snapshot?.nodes.length) return;
    const topLevel = snapshot.nodes.filter((node) => !node.parentId);
    const minX = Math.min(...topLevel.map((node) => node.position.x));
    const minY = Math.min(...topLevel.map((node) => node.position.y));
    const target = position ?? reactFlow.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const idMap = new Map(snapshot.nodes.map((node) => [node.id, randomUuid()]));
    const pastedNodes = snapshot.nodes.map((node) => ({
      ...node,
      id: idMap.get(node.id) as string,
      parentId: node.parentId ? idMap.get(node.parentId) : undefined,
      position: node.parentId
        ? node.position
        : { x: node.position.x - minX + target.x + 24, y: node.position.y - minY + target.y + 24 },
      selected: true,
      data: {
        ...node.data,
        busy: false,
        taskId: undefined,
        result: undefined,
        error: "",
        canResume: false,
        uploadAsset: (file) => uploadAssetRef.current(file),
        update,
        remove,
        generate: (id) => generateRef.current(id),
      },
    })) as WorkNode[];
    const pastedEdges = snapshot.edges.map((edge) => ({
      ...edge,
      id: randomUuid(),
      source: idMap.get(edge.source) as string,
      target: idMap.get(edge.target) as string,
      selected: false,
    }));
    markUnsaved();
    setNodes((current) => [
      ...current.map((node) => ({ ...node, selected: false })),
      ...pastedNodes,
    ]);
    setEdges((current) => [...current, ...pastedEdges]);
    setSelectedIds(pastedNodes.map((node) => node.id));
    setNodeContextMenu(undefined);
  }, [markUnsaved, reactFlow, remove, setEdges, setNodes, update]);
  const groupCanvasSelection = useCallback((ids = selectedIds) => {
    const selected = nodesRef.current.filter((node) => ids.includes(node.id) && !node.parentId && node.data.kind !== "group");
    if (selected.length < 2) return;
    const minX = Math.min(...selected.map((node) => node.position.x));
    const minY = Math.min(...selected.map((node) => node.position.y));
    const maxX = Math.max(...selected.map((node) => node.position.x + (node.measured?.width ?? 340)));
    const maxY = Math.max(...selected.map((node) => node.position.y + (node.measured?.height ?? 220)));
    const groupId = randomUuid();
    const groupX = minX - 28;
    const groupY = minY - 52;
    const groupNode: WorkNode = {
      id: groupId,
      type: "work",
      position: { x: groupX, y: groupY },
      style: { width: Math.max(400, maxX - minX + 56), height: Math.max(280, maxY - minY + 80) },
      data: {
        kind: "group",
        title: "节点组",
        prompt: "",
        ratio: "1:1",
        quality: "720p",
        duration: 0,
        uploadAsset: (file) => uploadAssetRef.current(file),
        update,
        remove,
        generate: (id) => generateRef.current(id),
      },
      selected: true,
    };
    const selectedSet = new Set(selected.map((node) => node.id));
    markUnsaved();
    setNodes((current) => [
      groupNode,
      ...current.map((node) => selectedSet.has(node.id)
        ? {
            ...node,
            parentId: groupId,
            extent: "parent" as const,
            expandParent: false,
            position: { x: node.position.x - groupX, y: node.position.y - groupY },
            selected: false,
          }
        : { ...node, selected: false }),
    ]);
    setSelectedIds([groupId]);
    setNodeContextMenu(undefined);
  }, [markUnsaved, remove, selectedIds, setNodes, update]);
  const ungroupCanvasSelection = useCallback((groupId: string) => {
    const group = nodesRef.current.find((node) => node.id === groupId && node.data.kind === "group");
    if (!group) return;
    const memberIds: string[] = [];
    markUnsaved();
    setNodes((current) => current.filter((node) => node.id !== groupId).map((node): WorkNode => {
      if (node.parentId !== groupId) return { ...node, selected: false };
      memberIds.push(node.id);
      return {
        ...node,
        parentId: undefined,
        extent: undefined,
        expandParent: undefined,
        position: { x: group.position.x + node.position.x, y: group.position.y + node.position.y },
        selected: true,
      };
    }));
    setEdges((current) => current.filter((edge) => edge.source !== groupId && edge.target !== groupId));
    setSelectedIds(memberIds);
    setNodeContextMenu(undefined);
  }, [markUnsaved, setEdges, setNodes]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        if (!deletedCanvasStackRef.current.length) return;
        event.preventDefault();
        restoreDeletedCanvas();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        if (!selectedIds.length) return;
        event.preventDefault();
        copyCanvasSelection();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "x") {
        if (!selectedIds.length) return;
        event.preventDefault();
        cutCanvasSelection();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteCanvasSelection();
        return;
      }
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (!selectedIds.length) return;
      event.preventDefault();
      deleteCanvasNodes(selectedIds);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [copyCanvasSelection, cutCanvasSelection, deleteCanvasNodes, pasteCanvasSelection, restoreDeletedCanvas, selectedIds]);
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
    clearPollingTask(nodeId);
    activePollingTasksRef.current.set(nodeId, taskId);
    const pollingKey = `${nodeId}:${taskId}`;
    const isCurrentPollingTask = () => activePollingTasksRef.current.get(nodeId) === taskId;
    const stopPollingTask = () => {
      pollTimersRef.current.delete(pollingKey);
      if (isCurrentPollingTask()) activePollingTasksRef.current.delete(nodeId);
    };
    const timer = window.setTimeout(async () => {
      pollTimersRef.current.delete(pollingKey);
      if (!isCurrentPollingTask()) return;
      if (interruptedRef.current.has(nodeId)) return;
      if (!nodesRef.current.some((node) => node.id === nodeId)) {
        stopPollingTask();
        return;
      }
      try {
        const response = await fetch(`/api/tasks/${taskId}`, { cache: "no-store" });
        const task = await readJson(response);
        if (!response.ok) throw new Error(responseError(task, "TASK_NOT_FOUND"));
        if (!isCurrentPollingTask()) return;
        if (interruptedRef.current.has(nodeId)) return;
        const taskPatch = mapTaskToNodePatch(task);
        if (!taskPatch.shouldPoll) {
          update(nodeId, taskPatch.patch);
          stopPollingTask();
          return;
        }
        if (attempt < VIDEO_POLL_MAX_ATTEMPTS) {
          update(nodeId, taskPatch.patch);
          pollTask(nodeId, taskId, attempt + 1);
        } else {
          update(nodeId, { busy: false, error: "视频生成超时，请稍后刷新任务或重试。" });
          stopPollingTask();
        }
      } catch (error) {
        update(nodeId, { busy: false, error: error instanceof Error ? localizeError(error.message) : "查询视频任务失败" });
        stopPollingTask();
      }
    }, VIDEO_POLL_INTERVAL_MS);
    pollTimersRef.current.set(pollingKey, timer);
  }, [clearPollingTask, update]);

  const generate = useCallback(async (id: string) => {
    const node = nodesRef.current.find((item) => item.id === id);
    if (!node) return;
    if (node.data.busy) {
      clearPollingTask(id);
      interruptedRef.current.add(id);
      update(id, { busy: false, result: "已打断生成同步，远端任务可能仍在后台继续。", error: "" });
      return;
    }
    // If canResume and has taskId, call resume API instead of generating new
    if (node.data.canResume && node.data.taskId) {
      try {
        interruptedRef.current.delete(id);
        update(id, { busy: true, result: "恢复查询中...", error: "", canResume: false });
        const response = await fetch(`/api/tasks/${node.data.taskId}/resume`, { method: "PATCH" });
        const body = await readJson(response);
        if (!response.ok) throw new Error(responseError(body, "UNKNOWN_ERROR"));
        pollTask(id, node.data.taskId);
      } catch (error) {
        update(id, { busy: false, error: error instanceof Error ? localizeError(error.message) : "恢复查询失败", canResume: true });
      }
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
    const modelDefinition = node.data.kind === "image" || node.data.kind === "video"
      ? getModelDefinition(node.data.model ?? (node.data.kind === "image" ? "agnes-image-2.1-flash" : "agnes-video-v2.0"))
      : undefined;
    if (modelDefinition?.provider === "apimart" && modelDefinition.keyScope === "dev" && !configRef.current.apimartDevConfigured) return update(id, { error: "请先在 .env 中配置 APIMART_KEY_DEV。" });
    if (modelDefinition?.provider === "apimart" && modelDefinition.keyScope !== "dev" && node.data.kind === "image" && !configRef.current.apimartImageConfigured) return update(id, { error: "请先在 .env 中配置 APIMART_KEY_IMAGE。" });
    if (modelDefinition?.provider === "apimart" && modelDefinition.keyScope !== "dev" && node.data.kind === "video" && !configRef.current.apimartVideoConfigured) return update(id, { error: "请先在 .env 中配置 APIMART_KEY_VIDEO。" });
    if (modelDefinition?.provider === "agnes" && !configRef.current.agnesConfigured) return update(id, { error: "请先在 .env 中配置 Agnes API Key。" });
    if (modelDefinition?.provider === "agnes" && node.data.kind === "video" && (node.data.startFrameUrl || node.data.endFrameUrl || node.data.referenceFrameUrls?.length || upstream.some((item) => item.data.url && !item.data.kind.includes("video"))) && !configRef.current.agnesPublicImageStorageConfigured) {
      return update(id, { error: "请先在 .env 中配置 SUPABASE_SERVICE_ROLE_KEY。" });
    }

    update(id, { busy: true, error: "", result: node.data.kind === "video" ? "排队中" : undefined });
    try {
      let response: Response;
      if (node.data.kind === "text") {
        response = await fetch("/api/text/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      } else if (node.data.kind === "image") {
        const model = node.data.model ?? "agnes-image-2.1-flash";
        const rawReferenceUrls = [node.data.startFrameUrl, ...upstream.filter((item) => item.data.url && !item.data.kind.includes("video")).map((item) => item.data.url)].filter((url): url is string => Boolean(url));
        const referenceUrls = await Promise.all(rawReferenceUrls.map(materializeReferenceUrl));
        response = await fetch("/api/images/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            size: imageSize(node.data.ratio, node.data.quality),
            aspectRatio: node.data.ratio,
            quality: node.data.quality,
            ratio: node.data.ratio,
            resolution: node.data.quality,
            model,
            referenceUrls,
          }),
        });
      } else {
        const model = modelDefinition ?? getModelDefinition("agnes-video-v2.0");
        const normalizedVideoOptions = sanitizeVideoOptionsForModel(model.id, {
          mode: node.data.videoMode,
          aspectRatio: node.data.ratio,
          resolution: node.data.quality,
          duration: node.data.duration,
          hasStartFrame: Boolean(node.data.startFrameUrl),
          hasEndFrame: Boolean(node.data.endFrameUrl),
          hasImageInput: Boolean(node.data.referenceFrameUrls?.length || upstream.some((item) => item.data.url && !item.data.kind.includes("video"))),
        });
        const requestedQuality = normalizedVideoOptions.resolution;
        const requestedFrames = Math.min(MAX_VIDEO_FRAMES, Math.max(25, Math.round((normalizedVideoOptions.duration * VIDEO_FRAME_RATE - 1) / 8) * 8 + 1));
        const safeQuality = model.provider === "agnes" ? (requestedQuality === "720p" ? requestedQuality : SAFE_VIDEO_QUALITY) : requestedQuality;
        const safeFrames = model.provider === "agnes" ? Math.min(SAFE_VIDEO_MAX_FRAMES, requestedFrames) : requestedFrames;
        const { width, height } = getVideoDimensions(normalizedVideoOptions.aspectRatio, safeQuality);
        if (model.provider === "agnes" && (requestedQuality !== safeQuality || requestedFrames !== safeFrames)) {
          update(id, {
            result: `已按稳定生成策略提交：${safeQuality.toUpperCase()} · ${safeFrames} 帧。高画质或长时长容易触发 Agnes 上游显存不足。`,
          });
        }
        const form = new FormData();
        form.set("prompt", prompt);
        form.set("model", model.id);
        form.set("ratio", normalizedVideoOptions.aspectRatio);
        form.set("aspectRatio", normalizedVideoOptions.aspectRatio);
        form.set("resolution", normalizedVideoOptions.resolution);
        form.set("quality", normalizedVideoOptions.resolution);
        form.set("duration", String(normalizedVideoOptions.duration));
        if (node.data.negativePrompt) form.set("negativePrompt", node.data.negativePrompt);
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
          await appendImageFromUrl(form, "startFrame", node.data.startFrameUrl, node.data.startFrameName ?? "reference-start.png");
        }
        if (node.data.endFrameUrl) {
          await appendImageFromUrl(form, "endFrame", node.data.endFrameUrl, node.data.endFrameName ?? "reference-end.png");
        }
        const nodeReferenceUrls = node.data.referenceFrameUrls ?? [];
        for (const [index, url] of nodeReferenceUrls.entries()) {
          await appendImageFromUrl(form, "referenceImages", url, node.data.referenceFrameNames?.[index] || `reference-${index + 1}.png`, "append");
        }
        for (const [index, source] of imageSources.entries()) {
          if (source.data.url) {
            await appendImageFromUrl(form, "referenceImages", String(source.data.url), source.data.title || `connected-reference-${index + 1}.png`, "append");
          }
        }
        response = await fetch("/api/videos/generate", { method: "POST", body: form });
      }
      const body = await readJson(response);
      if (!response.ok) throw new Error(responseError(body, "UNKNOWN_ERROR"));
      if ((node.data.kind === "video" || node.data.kind === "image") && body.id && !body.outputUrl) {
        update(id, { busy: true, taskId: body.id, result: "排队中" });
        pollTask(id, body.id);
      } else {
        update(id, { busy: false, result: body.text, url: body.outputUrl, error: "" });
      }
    } catch (error) {
      update(id, { busy: false, error: error instanceof Error ? localizeError(error.message) : "生成失败" });
    }
  }, [clearPollingTask, pollTask, update]);
  useEffect(() => {
    generateRef.current = generate;
  }, [generate]);

  const uploadCanvasFile = useCallback(async (file: File) => {
    const projectId = projectRef.current?.id;
    if (!projectId) throw new Error("PROJECT_NOT_READY");
    const form = new FormData();
    form.set("file", file);
    form.set("projectId", projectId);
    const response = await fetch("/api/uploads", { method: "POST", body: form });
    const body = await readJson(response);
    if (!response.ok || !body.url) throw new Error(String(body.error ?? "UPLOAD_FAILED"));
    return String(body.url);
  }, []);
  useEffect(() => { uploadAssetRef.current = uploadCanvasFile; }, [uploadCanvasFile]);
  const addUploadedFileToLibrary = useCallback(async (file?: File) => {
    if (!file) return;
    try {
      const url = await uploadCanvasFile(file);
      const item: MaterialLibraryItem = {
        id: randomUuid(),
        name: file.name,
        kind: file.type.startsWith("video/") ? "video" : "image",
        folderId: activeLibraryFolderId,
        url,
        createdAt: new Date().toISOString(),
      };
      setMaterialLibrary((current) => [item, ...current].slice(0, 80));
      if (activeLibraryFolderId) setExpandedLibraryFolderIds((current) => current.includes(activeLibraryFolderId) ? current : [...current, activeLibraryFolderId]);
      setMaterialLibraryOpen(true);
      markUnsaved();
    } catch (error) {
      setSaveStatus("error");
      window.alert(error instanceof Error ? error.message : "素材上传失败");
    }
  }, [activeLibraryFolderId, markUnsaved, uploadCanvasFile]);
  const createLibraryFolder = useCallback((folderId = activeLibraryFolderId) => {
    const item: MaterialLibraryItem = {
      id: randomUuid(),
      name: "新建文件夹",
      kind: "folder",
      folderId,
      createdAt: new Date().toISOString(),
    };
    setMaterialLibrary((current) => [item, ...current].slice(0, 100));
    if (folderId) setExpandedLibraryFolderIds((current) => current.includes(folderId) ? current : [...current, folderId]);
    setEditingLibraryItemId(item.id);
    setEditingLibraryName(item.name);
    markUnsaved();
  }, [activeLibraryFolderId, markUnsaved]);
  const startRenameLibraryItem = useCallback((item: MaterialLibraryItem) => {
    setEditingLibraryItemId(item.id);
    setEditingLibraryName(item.name);
  }, []);
  const commitRenameLibraryItem = useCallback(() => {
    if (!editingLibraryItemId) return;
    const nextName = editingLibraryName.trim();
    if (!nextName) {
      setEditingLibraryItemId(null);
      setEditingLibraryName("");
      return;
    }
    setMaterialLibrary((current) => current.map((item) => item.id === editingLibraryItemId ? { ...item, name: nextName } : item));
    setEditingLibraryItemId(null);
    setEditingLibraryName("");
    markUnsaved();
  }, [editingLibraryItemId, editingLibraryName, markUnsaved]);
  const toggleLibraryFolder = useCallback((folderId: string) => {
    setExpandedLibraryFolderIds((current) => current.includes(folderId)
      ? current.filter((id) => id !== folderId)
      : [...current, folderId]);
  }, []);
  const openLibraryMenu = useCallback((event: React.MouseEvent, item: MaterialLibraryItem) => {
    event.preventDefault();
    event.stopPropagation();
    setLibraryMenu({ id: item.id, screen: { x: event.clientX, y: event.clientY }, mode: "actions" });
  }, []);
  useEffect(() => {
    if (!libraryMenu) return;
    const closeMenu = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".material-item-menu, .material-more-button")) return;
      setLibraryMenu(null);
    };
    window.addEventListener("pointerdown", closeMenu);
    return () => window.removeEventListener("pointerdown", closeMenu);
  }, [libraryMenu]);
  useEffect(() => {
    if (!homeMenuOpen) return;
    const closeMenu = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".home-menu-wrap")) return;
      setHomeMenuOpen(false);
    };
    window.addEventListener("pointerdown", closeMenu);
    return () => window.removeEventListener("pointerdown", closeMenu);
  }, [homeMenuOpen]);
  const isLibraryDescendant = useCallback((candidateFolderId: string | null, itemId: string) => {
    let cursor = candidateFolderId;
    while (cursor) {
      if (cursor === itemId) return true;
      cursor = materialLibrary.find((item) => item.id === cursor)?.folderId ?? null;
    }
    return false;
  }, [materialLibrary]);
  const moveLibraryItem = useCallback((itemId: string, folderId: string | null) => {
    if (isLibraryDescendant(folderId, itemId)) return;
    setMaterialLibrary((current) => current.map((item) => item.id === itemId ? { ...item, folderId } : item));
    setLibraryMenu(null);
    markUnsaved();
  }, [isLibraryDescendant, markUnsaved]);
  const duplicateLibraryItem = useCallback((itemId: string) => {
    const source = materialLibrary.find((item) => item.id === itemId);
    if (!source) return;
    const idMap = new Map<string, string>();
    const cloneItem = (item: MaterialLibraryItem): MaterialLibraryItem => {
      const nextId = idMap.get(item.id) ?? randomUuid();
      idMap.set(item.id, nextId);
      return {
        ...item,
        id: nextId,
        name: `${item.name} copy`,
        folderId: item.folderId && idMap.has(item.folderId) ? idMap.get(item.folderId) : item.folderId,
        nodes: item.nodes?.map((node) => ({ ...node, id: randomUuid(), selected: false })),
        edges: item.edges?.map((edge) => ({ ...edge, id: randomUuid(), selected: false })),
        createdAt: new Date().toISOString(),
      };
    };
    const descendants = materialLibrary.filter((item) => isLibraryDescendant(item.folderId ?? null, source.id));
    const clonedSource = cloneItem(source);
    const clonedDescendants = descendants.map((item) => {
      if (item.folderId && !idMap.has(item.folderId)) idMap.set(item.folderId, item.folderId);
      return cloneItem(item);
    });
    setMaterialLibrary((current) => [clonedSource, ...clonedDescendants, ...current].slice(0, 120));
    setLibraryMenu(null);
    markUnsaved();
  }, [isLibraryDescendant, markUnsaved, materialLibrary]);
  const deleteLibraryItem = useCallback((itemId: string) => {
    setMaterialLibrary((current) => current.filter((item) => item.id !== itemId && !isLibraryDescendant(item.folderId ?? null, itemId)));
    setExpandedLibraryFolderIds((current) => current.filter((id) => id !== itemId));
    if (activeLibraryFolderId === itemId) setActiveLibraryFolderId(null);
    setLibraryMenu(null);
    markUnsaved();
  }, [activeLibraryFolderId, isLibraryDescendant, markUnsaved]);
  const fanOutGroupConnection = useCallback((sourceId: string, targetId: string) => {
    const source = nodesRef.current.find((node) => node.id === sourceId);
    const sourceIds = source?.data.kind === "group"
      ? nodesRef.current.filter((node) => node.parentId === sourceId).map((node) => node.id)
      : [sourceId];
    if (!sourceIds.length) return;
    markUnsaved();
    setEdges((current) => sourceIds.reduce(
      (next, memberId) => addEdge({ id: `${memberId}-${targetId}-${randomUuid()}`, source: memberId, target: targetId, animated: true }, next),
      current,
    ));
  }, [markUnsaved, setEdges]);

  const addNode = useCallback(async (kind: Kind, position?: { x: number; y: number }, file?: File, sourceId?: string) => {
    const point = position ?? reactFlow.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const id = randomUuid();
    let persistentUrl: string | undefined;
    if (file) {
      try {
        persistentUrl = await uploadCanvasFile(file);
      } catch (error) {
        setSaveStatus("error");
        window.alert(error instanceof Error ? error.message : "上传素材失败");
        return undefined;
      }
    }
    const videoDefaults = kind === "video" ? sanitizeVideoOptionsForModel("kling-v3-omni", {}) : undefined;
    markUnsaved();
    setNodes((current) => [...current, {
      id,
      type: "work",
      position: { x: point.x - 140, y: point.y - 70 },
      data: {
        kind,
        title: file?.name ?? KIND_META[kind].title,
        prompt: "",
        ratio: videoDefaults?.aspectRatio ?? (kind === "video" ? "16:9" : "1:1"),
        quality: videoDefaults?.resolution ?? (kind === "video" ? "720p" : "1k"),
        model: kind === "image" ? "gpt-image-2" : kind === "video" ? "kling-v3-omni" : undefined,
        videoMode: videoDefaults?.mode,
        motionPreset: kind === "video" ? "auto" : undefined,
        duration: videoDefaults?.duration ?? 5,
        negativePrompt: "",
        url: persistentUrl,
        uploadAsset: (nextFile) => uploadAssetRef.current(nextFile),
        update,
        remove,
        generate,
      },
    }]);
    if (sourceId) fanOutGroupConnection(sourceId, id);
    setMenu(undefined);
    return id;
  }, [fanOutGroupConnection, generate, markUnsaved, reactFlow, remove, setNodes, update, uploadCanvasFile]);

  const addLibraryItemToCanvas = useCallback((item: MaterialLibraryItem) => {
    const target = reactFlow.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    if (item.nodes?.length) {
      const topLevel = item.nodes.filter((node) => !node.parentId);
      const minX = Math.min(...topLevel.map((node) => node.position.x));
      const minY = Math.min(...topLevel.map((node) => node.position.y));
      const idMap = new Map(item.nodes.map((node) => [node.id, randomUuid()]));
      const pastedNodes = item.nodes.map((node) => ({
        ...node,
        id: idMap.get(node.id) as string,
        parentId: node.parentId ? idMap.get(node.parentId) : undefined,
        position: node.parentId
          ? node.position
          : { x: node.position.x - minX + target.x, y: node.position.y - minY + target.y },
        selected: true,
        data: {
          ...node.data,
          busy: false,
          taskId: undefined,
          error: "",
          canResume: false,
          uploadAsset: (file) => uploadAssetRef.current(file),
          update,
          remove,
          generate: (nodeId) => generateRef.current(nodeId),
        },
      })) as WorkNode[];
      const pastedEdges = (item.edges ?? []).map((edge) => ({
        ...edge,
        id: randomUuid(),
        source: idMap.get(edge.source) as string,
        target: idMap.get(edge.target) as string,
        selected: false,
      })).filter((edge) => edge.source && edge.target);
      markUnsaved();
      setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), ...pastedNodes]);
      setEdges((current) => [...current, ...pastedEdges]);
      setSelectedIds(pastedNodes.map((node) => node.id));
      return;
    }
      if (!item.url) return;
    const url = item.url;
    const nodeKind: Kind = item.kind === "video" ? "media-video" : "media-image";
    void addNode(nodeKind, target).then(() => {
      setNodes((current) => current.map((node, index, all) => index === all.length - 1 ? {
        ...node,
        data: { ...node.data, title: item.name, url },
      } : node));
    });
  }, [addNode, markUnsaved, reactFlow, remove, setEdges, setNodes, update]);

  const openMenu = useCallback((x: number, y: number, sourceId?: string) => setMenu({ screen: { x, y }, flow: reactFlow.screenToFlowPosition({ x, y }), sourceId }), [reactFlow]);
  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    fanOutGroupConnection(connection.source, connection.target);
  }, [fanOutGroupConnection]);
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
      maxZoom: 0.92,
    });
  }, [reactFlow]);
  const openNodeContextMenu = useCallback((event: React.MouseEvent, node: WorkNode) => {
    event.preventDefault();
    const selection = selectedIds.includes(node.id) ? selectedIds : [node.id];
    if (!selectedIds.includes(node.id)) {
      setNodes((current) => current.map((item) => ({ ...item, selected: item.id === node.id })));
      setSelectedIds([node.id]);
    }
    setMenu(undefined);
    setNodeContextMenu({
      nodeId: node.id,
      screen: { x: event.clientX, y: event.clientY },
      flow: reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
    });
    if (selection.length !== selectedIds.length) setSelectedIds(selection);
  }, [reactFlow, selectedIds, setNodes]);

  const canvasProjectData = useCallback(() => {
    const storedNodes = nodesRef.current.map((node) => {
      const storedNode = serializeWorkNode(node);
      return {
        ...storedNode,
        selected: false,
        data: {
          ...storedNode.data,
          busy: false,
          settingsOpen: false,
          negativePromptOpen: false,
        },
      };
    });
    return {
      nodes: storedNodes,
      edges: edgesRef.current,
      viewport: reactFlow.getViewport(),
      libraryItems: materialLibraryRef.current,
    };
  }, [reactFlow]);

  const saveProject = useCallback(async (name?: string) => {
    const current = projectRef.current;
    if (!current) return false;
    setSaveStatus("saving");
    try {
      const response = await fetch(`/api/projects/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasData: canvasProjectData(),
          ...(name ? { name } : {}),
        }),
      });
      const body = await readJson(response) as CanvasProject & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "PROJECT_SAVE_FAILED");
      setProject(body);
      projectRef.current = body;
      dirtyRef.current = false;
      setSaveStatus("saved");
      return true;
    } catch {
      setSaveStatus("error");
      return false;
    }
  }, [canvasProjectData]);

  const renameProject = useCallback(async () => {
    const name = renameValue.trim();
    if (!name || name.toLowerCase() === "empty space") {
      setRenameError("请输入新的项目名称");
      return;
    }
    setRenameError("");
    if (await saveProject(name)) setRenameOpen(false);
  }, [renameValue, saveProject]);

  const reconcileLoadedTaskNodes = useCallback(async (loadedNodes: WorkNode[]) => {
    let changed = false;
    const polling: Array<{ nodeId: string; taskId: string }> = [];
    const nodes = await Promise.all(loadedNodes.map(async (node) => {
      if (node.data.kind !== "video" || !node.data.taskId) return node;
      try {
        const response = await fetch(`/api/tasks/${node.data.taskId}`, { cache: "no-store" });
        const task = await readJson(response);
        if (!response.ok) return node;

        const taskPatch = mapTaskToNodePatch(task);
        if (!taskPatch.changed) return node;
        changed = true;
        if (taskPatch.shouldPoll) {
          polling.push({ nodeId: node.id, taskId: node.data.taskId });
        }
        return { ...node, data: { ...node.data, ...taskPatch.patch } };
      } catch {
        return node;
      }
      return node;
    }));
    return { nodes, polling, changed };
  }, []);

  useEffect(() => {
    let cancelled = false;
    clearAllPollingTasks();

    const loadProject = async () => {
      projectLoadedRef.current = false;
      setSaveStatus("loading");
      let targetId = requestedProjectId || window.localStorage.getItem("genora-current-project");
      let loaded: CanvasProject | undefined;

      if (targetId) {
        const response = await fetch(`/api/projects/${targetId}`);
        if (response.ok) loaded = await readJson(response) as CanvasProject;
      }
      if (!loaded) {
        const response = await fetch("/api/projects");
        const projects = response.ok ? await readJson(response) as CanvasProject[] : [];
        loaded = projects[0];
      }
      if (!loaded) {
        const response = await fetch("/api/projects", { method: "POST" });
        if (!response.ok) throw new Error("PROJECT_CREATE_FAILED");
        loaded = await readJson(response) as CanvasProject;
      }
      if (cancelled) return;

      const hydratedNodes = loaded.canvasData.nodes.map((node) => {
        const model = node.data.kind === "image" || node.data.kind === "video"
          ? getModelDefinition(node.data.model ?? (node.data.kind === "image" ? "agnes-image-2.1-flash" : "kling-v3-omni"))
          : undefined;
        const videoOptions = node.data.kind === "video" && model ? sanitizeVideoOptionsForModel(model.id, {
          mode: node.data.videoMode,
          aspectRatio: node.data.ratio,
          resolution: node.data.quality,
          duration: node.data.duration,
          hasStartFrame: Boolean(node.data.startFrameUrl),
          hasEndFrame: Boolean(node.data.endFrameUrl),
          hasImageInput: Boolean(node.data.referenceFrameUrls?.length || node.data.hasImageInput),
        }) : undefined;
        const quality = model && !videoOptions && !model.resolutions.includes(node.data.quality)
          ? model.defaultResolution
          : node.data.quality;
        return {
          ...node,
          data: {
            ...node.data,
            ratio: videoOptions?.aspectRatio ?? node.data.ratio,
            quality: videoOptions?.resolution ?? quality,
            duration: videoOptions?.duration ?? node.data.duration,
            videoMode: videoOptions?.mode ?? node.data.videoMode,
            busy: false,
            uploadAsset: (file) => uploadAssetRef.current(file),
            update,
            remove,
            generate,
          },
        };
      }) as WorkNode[];
      let launchChanged = false;
      let launchNodes = hydratedNodes;
      if (!launchNodes.length && launchPrompt && (launchKind === "image" || launchKind === "video")) {
        const fallbackModel = launchKind === "image" ? "agnes-image-2.1-flash" : "agnes-video-v2.0";
        let modelId = launchModel || fallbackModel;
        try {
          const model = getModelDefinition(modelId);
          if (model.kind !== launchKind) modelId = fallbackModel;
        } catch {
          modelId = fallbackModel;
        }
        const imageOptions = normalizeModelOptions(modelId, {
          ratio: launchKind === "video" ? "16:9" : "1:1",
          resolution: launchKind === "video" ? "720p" : "1k",
          duration: 5,
        });
        const videoOptions = launchKind === "video" ? sanitizeVideoOptionsForModel(modelId, {
          aspectRatio: "16:9",
          resolution: "720p",
          duration: 5,
        }) : undefined;
        launchNodes = [{
          id: randomUuid(),
          type: "work",
          position: { x: -170, y: -120 },
          data: {
            kind: launchKind,
            title: KIND_META[launchKind].title,
            prompt: launchPrompt,
            ratio: videoOptions?.aspectRatio ?? imageOptions.ratio,
            quality: videoOptions?.resolution ?? imageOptions.resolution,
            model: modelId,
            videoMode: videoOptions?.mode,
            motionPreset: launchKind === "video" ? "auto" : undefined,
            duration: launchKind === "video" ? videoOptions?.duration ?? imageOptions.duration : 0,
            negativePrompt: "",
            uploadAsset: (file) => uploadAssetRef.current(file),
            update,
            remove,
            generate,
          },
        }];
        launchChanged = true;
      }
      const reconciled = await reconcileLoadedTaskNodes(launchNodes);
      if (cancelled) return;
      setNodes(reconciled.nodes);
      setEdges(loaded.canvasData.edges);
      setMaterialLibrary(loaded.canvasData.libraryItems ?? []);
      setProject(loaded);
      projectRef.current = loaded;
      setRenameValue(loaded.name === "empty space" ? "" : loaded.name);
      setRenameOpen(loaded.requiresRename);
      window.localStorage.setItem("genora-current-project", loaded.id);
      window.history.replaceState(null, "", `/workspace?project=${encodeURIComponent(loaded.id)}`);
      window.requestAnimationFrame(() => {
        void reactFlow.setViewport(loaded.canvasData.viewport, { duration: 0 });
      });
      dirtyRef.current = false;
      projectLoadedRef.current = true;
      if (reconciled.changed || launchChanged) {
        dirtyRef.current = true;
        setSaveStatus("unsaved");
        window.setTimeout(() => void saveProject(), 0);
      } else {
        setSaveStatus("saved");
      }
      reconciled.polling.forEach(({ nodeId, taskId }) => pollTask(nodeId, taskId));
    };

    loadProject().catch(() => setSaveStatus("error"));
    return () => {
      cancelled = true;
      clearAllPollingTasks();
    };
  }, [clearAllPollingTasks, generate, launchKind, launchModel, launchPrompt, pollTask, reactFlow, reconcileLoadedTaskNodes, remove, requestedProjectId, saveProject, setEdges, setNodes, update]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (dirtyRef.current && projectLoadedRef.current) void saveProject();
    }, 10 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [saveProject]);

  useEffect(() => {
    const onSaveShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      if (projectRef.current?.requiresRename) {
        setRenameOpen(true);
        return;
      }
      void saveProject();
    };
    window.addEventListener("keydown", onSaveShortcut);
    return () => window.removeEventListener("keydown", onSaveShortcut);
  }, [saveProject]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const undoAgentActions = useCallback(() => {
    const snap = agentSnapshotRef.current;
    if (!snap) return;
    agentSnapshotRef.current = null;
    setAgentCanUndo(false);
    markUnsaved();
    setNodes(snap.nodes);
    setEdges(snap.edges);
    setSelectedIds([]);
  }, [markUnsaved, setEdges, setNodes]);

  const dispatchAgentToolCalls = useCallback(async (toolCalls: AgentToolCall[]): Promise<string[]> => {
    const log: string[] = [];
    const validNodeId = (id: unknown): string | null => {
      if (typeof id !== "string" || !id) return null;
      return nodesRef.current.some((node) => node.id === id) ? id : null;
    };
    for (const call of toolCalls) {
      const fn = call.function;
      const name = fn?.name;
      if (!name || !AGENT_TOOL_NAMES.has(name)) {
        log.push("忽略了无法识别的指令");
        continue;
      }
      if (call.id && executedToolCallIdsRef.current.has(call.id)) {
        log.push("这条已经处理过了");
        continue;
      }
      if (call.id) executedToolCallIdsRef.current.add(call.id);
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(fn?.arguments || "{}");
      } catch {
        log.push("指令参数有误，已跳过");
        continue;
      }
      try {
        if (name === "addNode") {
          const type = ["text", "image", "video"].includes(args.type as string) ? (args.type as Kind) : null;
          if (!type) { log.push("节点类型无效，已跳过"); continue; }
          const pos = args.position as { x?: number; y?: number } | undefined;
          const position = pos && typeof pos.x === "number" && typeof pos.y === "number" ? { x: pos.x, y: pos.y } : undefined;
          const newId = await addNode(type, position);
          if (!newId) { log.push("添加节点失败"); continue; }
          if (typeof args.prompt === "string" && args.prompt.trim()) update(newId, { prompt: args.prompt });
          log.push(`已在画布中生成${KIND_META[type].title}节点${typeof args.prompt === "string" && args.prompt ? `「${args.prompt.slice(0, 20)}」` : ""}`);
        } else if (name === "updateNode") {
          const id = validNodeId(args.nodeId);
          if (!id) { log.push("找不到该节点，已跳过"); continue; }
          const patchSrc = args.patch && typeof args.patch === "object" ? (args.patch as Record<string, unknown>) : {};
          const patch: Partial<StoredWorkData> = {};
          if (typeof patchSrc.prompt === "string") patch.prompt = patchSrc.prompt;
          if (typeof patchSrc.title === "string") patch.title = patchSrc.title;
          if (typeof patchSrc.ratio === "string" && RATIOS.includes(patchSrc.ratio as Ratio)) patch.ratio = patchSrc.ratio as Ratio;
          if (Object.keys(patch).length) { update(id, patch); log.push("已更新节点"); }
          else log.push("节点无需更新");
        } else if (name === "removeNode") {
          const id = validNodeId(args.nodeId);
          if (!id) { log.push("找不到该节点，已跳过"); continue; }
          remove(id);
          log.push("已删除节点");
        } else if (name === "generateNode") {
          const id = validNodeId(args.nodeId);
          if (!id) { log.push("找不到该节点，已跳过"); continue; }
          generate(id);
          log.push("已开始生成");
        } else if (name === "addEdge") {
          const from = validNodeId(args.sourceNodeId);
          const to = validNodeId(args.targetNodeId);
          if (!from || !to) { log.push("找不到节点，已跳过"); continue; }
          setEdges((current) => addEdge({ id: `${from}-${to}-${randomUuid()}`, source: from, target: to, animated: true }, current));
          log.push("已连接节点");
        }
      } catch (error) {
        log.push(`执行出错了：${error instanceof Error ? error.message : "未知错误"}`);
      }
    }
    return log;
  }, [addNode, generate, remove, setEdges, update]);

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
      const selectedImageNodes = nodesRef.current
        .filter((node) => node.selected && (node.data.kind === "image" || node.data.kind === "media-image") && node.data.url)
        .slice(0, 4);
      const canvasImageParts: { type: "image_url"; image_url: { url: string } }[] = [];
      for (const node of selectedImageNodes) {
        try {
          canvasImageParts.push({ type: "image_url", image_url: { url: await localUrlToDataUrl(node.data.url as string) } });
        } catch {
          // Skip unreadable local references.
        }
      }
      const textPart = [
        "你是 Genora Agent，运行在画布旁。除了回答问题，你还可以调用工具直接操纵画布：addNode(添加节点)、updateNode(改字段)、removeNode(删除)、generateNode(触发生成)、addEdge(连线)。需要创建/修改/生成画布内容时，请调用对应工具，并用一句话说明你做了什么。",
        "",
        "【画布内容】",
        canvasSummary(),
        "",
        "【对话附件】",
        attachmentText,
        ...(selectedImageNodes.length ? ["", "【画布视觉】已附上选中的图片，你可以直接看图来分析画面、优化提示词或生成创意。"] : []),
        "",
        "【上下文】",
        history,
      ].join("\n");
      const imageParts = [
        ...attachments.filter((item) => item.kind === "image" && item.dataUrl).map((item) => ({ type: "image_url", image_url: { url: item.dataUrl } })),
        ...canvasImageParts,
      ];
      const response = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "agnes-2.0-flash",
          prompt: textPart,
          tools: AGENT_CANVAS_TOOLS,
          messages: [{ role: "user", content: [{ type: "text", text: textPart }, ...imageParts] }],
        }),
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(responseError(body, "UNKNOWN_ERROR"));
      const toolCalls = Array.isArray(body.tool_calls) ? (body.tool_calls as AgentToolCall[]) : [];
      let actionLog: string[] = [];
      if (toolCalls.length) {
        agentSnapshotRef.current = { nodes: [...nodesRef.current], edges: [...edgesRef.current] };
        setAgentCanUndo(true);
        actionLog = await dispatchAgentToolCalls(toolCalls);
      }
      const baseText = typeof body.text === "string" && body.text.trim() ? body.text : (actionLog.length ? "好的，已经帮你处理好。" : "我已经收到。");
      const footer = actionLog.length ? `\n${actionLog.join("；")}` : "";
      setAgentMessages((current) => [...current, { role: "assistant", content: baseText + footer }]);
    } catch (error) {
      setAgentMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? localizeError(error.message) : "Agent 调用失败", error: true }]);
    } finally {
      setAgentBusy(false);
    }
  }, [agentBusy, agentInput, canvasSummary, dispatchAgentToolCalls]);

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
      id: randomUuid(),
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
        <div className="home-menu-wrap">
          <button className="home-fab" aria-label="打开导航菜单" title="打开导航菜单" type="button" onClick={() => setHomeMenuOpen((current) => !current)}><img src="/assets/genora-logo.png" alt="" /></button>
          {homeMenuOpen && (
            <div className="home-menu glass">
              <Link href="/" onClick={() => setHomeMenuOpen(false)}>返回首页</Link>
              <Link href="/projects" onClick={() => setHomeMenuOpen(false)}>作品库</Link>
            </div>
          )}
        </div>
        <div className="top-title"><i className={`status-dot ${saveStatus}`} /><span>{project?.name ?? "empty space"}</span><small>{saveLabel}</small></div>
      </header>

      {renameOpen && (
        <div className="project-dialog-backdrop">
          <section className="project-dialog glass" role="dialog" aria-modal="true" aria-labelledby="project-name-title">
            <span className="project-dialog-kicker">新项目 · empty space</span>
            <h2 id="project-name-title">为画布重新命名</h2>
            <p>项目名称用于作品库识别，保存后仍可再次修改。</p>
            <input
              autoFocus
              value={renameValue}
              maxLength={80}
              placeholder="例如：夏日品牌短片"
              onChange={(event) => { setRenameValue(event.target.value); setRenameError(""); }}
              onKeyDown={(event) => { if (event.key === "Enter") void renameProject(); }}
            />
            {renameError && <small className="project-dialog-error">{renameError}</small>}
            <button onClick={() => void renameProject()} disabled={saveStatus === "saving"}>
              {saveStatus === "saving" ? "正在保存…" : "保存并开始创作"}
            </button>
          </section>
        </div>
      )}

      <input ref={imagePicker} hidden type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && addNode("media-image", undefined, event.target.files[0])} />
      <input ref={videoPicker} hidden type="file" accept="video/*" onChange={(event) => event.target.files?.[0] && addNode("media-video", undefined, event.target.files[0])} />
      <input ref={libraryPicker} hidden type="file" accept="image/*,video/*" onChange={(event) => {
        void addUploadedFileToLibrary(event.target.files?.[0]);
        event.target.value = "";
      }} />
      <input ref={agentImagePicker} hidden type="file" accept="image/*" onChange={(event) => importAgentMedia(event.target.files?.[0], "image")} />
      <input ref={agentVideoPicker} hidden type="file" accept="video/*" onChange={(event) => importAgentMedia(event.target.files?.[0], "video")} />

      <ReactFlow
        nodes={renderedNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={(changes) => {
          onNodesChange(changes);
          if (changes.some((change) => change.type !== "select")) markUnsaved();
          setSelectedIds((current) => {
            const next = new Set(current);
            changes.forEach((change) => {
              if (change.type === "select") change.selected ? next.add(change.id) : next.delete(change.id);
            });
            return [...next];
          });
        }}
        onEdgesChange={(changes) => {
          onEdgesChange(changes);
          if (changes.some((change) => change.type !== "select")) markUnsaved();
        }}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onDrop={onDrop}
        onWheel={onWheel}
        onNodeClick={focusNode}
        onNodeContextMenu={openNodeContextMenu}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
        onDoubleClick={(event) => { if (!(event.target as HTMLElement).closest(".react-flow__node")) openMenu(event.clientX, event.clientY); }}
        onPaneClick={() => { setMenu(undefined); setNodeContextMenu(undefined); setLibraryMenu(null); }}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1]}
        panActivationKeyCode={null}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        fitView
        fitViewOptions={{ maxZoom: 0.82 }}
        minZoom={0.25}
        maxZoom={2}
        colorMode="dark"
        defaultEdgeOptions={{ animated: true }}
        proOptions={{ hideAttribution: true }}
      >
        {gridVisible && <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#ffffff24" />}
        {miniMapOpen && <MiniMap position="bottom-right" pannable zoomable nodeColor="#8f7df5" maskColor="#050507a8" />}
        {!materialLibraryOpen && (
          <Panel position="top-left" className="sidebar glass">
            <button className="sidebar-add" title="添加节点" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); openMenu(rect.right + 24, rect.top + 18); }}><Icon name="plus" /></button>
            <button title="素材库" className={materialLibraryOpen ? "selected" : ""} onClick={() => setMaterialLibraryOpen((current) => !current)}><Icon name="folder" /></button>
            <button title="文本" onClick={() => addNode("text")}><Icon name="text" /></button>
            <button title="图像" onClick={() => addNode("image")}><Icon name="image" /></button>
            <button title="视频" onClick={() => addNode("video")}><Icon name="video" /></button>
          </Panel>
        )}
        {nodes.length === 0 && <Panel position="top-center" className="empty-canvas"><Icon name="plus" /><b>双击画布开始创作</b><span>添加文字、图片或视频生成节点</span></Panel>}
      </ReactFlow>

      {selectionAction && (
        <div className="selection-action-pop glass" style={{ left: selectionAction.left, top: selectionAction.top }}>
          <button className="selection-library-button" type="button" onClick={saveSelectionToLibrary}><Icon name="folder" />保存到素材库</button>
          {selectionAction.mode === "group" ? (
            <button className="selection-group-button" type="button" onClick={() => groupCanvasSelection()}><Icon name="grid" />打组</button>
          ) : (
            <button className="selection-group-button" type="button" onClick={() => selectionAction.groupId && ungroupCanvasSelection(selectionAction.groupId)}><Icon name="grid" />解组</button>
          )}
        </div>
      )}

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
      {nodeContextMenu && (
        <div className="node-context-menu glass" style={{ left: nodeContextMenu.screen.x, top: nodeContextMenu.screen.y }}>
          <header><b>节点操作</b><button onClick={() => setNodeContextMenu(undefined)}><Icon name="close" /></button></header>
          <button onClick={() => { copyCanvasSelection(); setNodeContextMenu(undefined); }}><span><b>复制</b><em>Ctrl+C</em></span></button>
          <button onClick={() => cutCanvasSelection()}><span><b>剪切</b><em>Ctrl+X</em></span></button>
          <button onClick={() => pasteCanvasSelection(nodeContextMenu.flow)}><span><b>粘贴</b><em>Ctrl+V</em></span></button>
          <hr />
          <button onClick={() => saveSelectionToLibrary()}><span><b>保存到素材库</b><em>单节点或当前选择</em></span></button>
          <button disabled={selectedIds.length < 2} onClick={() => groupCanvasSelection()}><span><b>打组</b><em>将选中节点放入容器</em></span></button>
          <button
            disabled={nodesRef.current.find((node) => node.id === nodeContextMenu.nodeId)?.data.kind !== "group"}
            onClick={() => ungroupCanvasSelection(nodeContextMenu.nodeId)}
          ><span><b>取消打组</b><em>保留成员位置与连线</em></span></button>
          <hr />
          <button className="danger" onClick={() => { deleteCanvasNodes(selectedIds.includes(nodeContextMenu.nodeId) ? selectedIds : [nodeContextMenu.nodeId]); setNodeContextMenu(undefined); }}>
            <span><b>删除</b><em>可使用 Ctrl+Z 撤回</em></span>
          </button>
        </div>
      )}

      {materialLibraryOpen && (
        <aside className="material-library-panel glass">
          <header>
            <button className="material-back-button" type="button" onClick={() => activeLibraryFolderId ? setActiveLibraryFolderId(activeLibraryFolder?.folderId ?? null) : setMaterialLibraryOpen(false)}>
              <Icon name="arrow-up" />
            </button>
            <div><b>素材库</b><span>{activeLibraryFolder?.name ?? "全部文件"}</span></div>
            <button type="button" onClick={() => setMaterialLibraryOpen(false)}><Icon name="close" /></button>
          </header>
          <div className="material-library-actions">
            <button className="material-upload-button" type="button" onClick={() => createLibraryFolder()}><Icon name="folder" />新建文件夹</button>
            <button className="material-upload-button" type="button" onClick={() => libraryPicker.current?.click()}><Icon name="upload" />上传资产</button>
          </div>
          <div className="material-library-grid">
            {!libraryTreeItems.length && <p className="material-empty">新建文件夹，或上传图片/视频资产。</p>}
            {libraryTreeItems.map(({ item, depth }) => {
              const isFolder = item.kind === "folder";
              const isExpanded = expandedLibraryFolderIds.includes(item.id);
              return (
              <article className={`material-card ${isFolder ? "folder" : ""} ${isExpanded ? "expanded" : ""}`} key={item.id} style={{ "--depth": depth } as CSSProperties}>
                <button className="material-folder-toggle" type="button" disabled={!isFolder} onClick={() => toggleLibraryFolder(item.id)}>
                  {isFolder && <Icon name="chevron" />}
                </button>
                <button className="material-preview" type="button" onClick={() => isFolder ? toggleLibraryFolder(item.id) : addLibraryItemToCanvas(item)}>
                  {item.url && item.kind === "image" ? <img src={item.url} alt={item.name} /> : null}
                  {item.url && item.kind === "video" ? <video src={item.url} muted /> : null}
                  {!item.url && <Icon name={item.kind === "folder" ? "folder" : item.kind === "video" ? "video" : item.kind === "image" ? "image" : "grid"} />}
                </button>
                <div className="material-meta">
                  {editingLibraryItemId === item.id ? (
                    <input
                      value={editingLibraryName}
                      autoFocus
                      onChange={(event) => setEditingLibraryName(event.target.value)}
                      onBlur={commitRenameLibraryItem}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitRenameLibraryItem();
                        if (event.key === "Escape") {
                          setEditingLibraryItemId(null);
                          setEditingLibraryName("");
                        }
                      }}
                    />
                  ) : (
                    <button type="button" onClick={() => startRenameLibraryItem(item)}>{item.name}</button>
                  )}
                  <span>{item.kind === "folder" ? "文件夹" : item.kind === "group" ? "组合资产" : item.kind === "node" ? "节点资产" : item.kind === "video" ? "视频资产" : "图片资产"}</span>
                </div>
                {item.kind !== "folder" && <button className="material-add-button" type="button" onClick={() => addLibraryItemToCanvas(item)}>添加</button>}
                <button className="material-more-button" type="button" aria-label="素材操作" onClick={(event) => openLibraryMenu(event, item)}><Icon name="ellipsis" /></button>
              </article>
              );
            })}
          </div>
        </aside>
      )}
      {libraryMenu && libraryMenuItem && (
        <div className="material-item-menu glass" style={{ left: libraryMenu.screen.x, top: libraryMenu.screen.y }} onPointerDown={(event) => event.stopPropagation()}>
          {libraryMenu.mode === "actions" ? (
            <>
              {libraryMenuItem.kind === "folder" && <button type="button" onClick={() => { setExpandedLibraryFolderIds((current) => current.includes(libraryMenuItem.id) ? current : [...current, libraryMenuItem.id]); createLibraryFolder(libraryMenuItem.id); setLibraryMenu(null); }}><Icon name="plus" />新建文件夹</button>}
              <button type="button" onClick={() => { startRenameLibraryItem(libraryMenuItem); setLibraryMenu(null); }}><Icon name="settings" />重命名</button>
              <button type="button" onClick={() => setLibraryMenu((current) => current ? { ...current, mode: "move" } : current)}><Icon name="folder" />移动到...</button>
              <button type="button" onClick={() => duplicateLibraryItem(libraryMenuItem.id)}><Icon name="copy" />创建副本</button>
              <hr />
              <button className="danger" type="button" onClick={() => deleteLibraryItem(libraryMenuItem.id)}><Icon name="trash" />删除</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => moveLibraryItem(libraryMenuItem.id, null)}><Icon name="folder" />全部文件</button>
              {materialFolders
                .filter((folder) => folder.id !== libraryMenuItem.id && !isLibraryDescendant(folder.id, libraryMenuItem.id))
                .map((folder) => (
                  <button type="button" key={folder.id} onClick={() => moveLibraryItem(libraryMenuItem.id, folder.id)}><Icon name="folder" />{folder.name}</button>
                ))}
            </>
          )}
        </div>
      )}

      <div className="canvas-control-bar glass">
        <button title="小地图" className={miniMapOpen ? "selected" : ""} onClick={() => setMiniMapOpen((current) => !current)}><Icon name="map" /></button>
        <button title="网格提示" className={gridVisible ? "selected" : ""} onClick={() => setGridVisible((current) => !current)}><Icon name="grid" /></button>
        <button title="适配画布" onClick={() => reactFlow.fitView({ duration: 220, maxZoom: 0.82 })}><Icon name="fit" /></button>
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
          <header><button aria-label="新建对话" onClick={resetAgent}><Icon name="plus" /></button><button aria-label="换一组灵感" onClick={inspire}><Icon name="bulb" /></button>{agentCanUndo && <button aria-label="撤销 Agent 操作" title="撤销 Agent 操作" onClick={undoAgentActions}><Icon name="history" /></button>}<button aria-label="关闭 Agent" onClick={() => setAgentOpen(false)}><Icon name="close" /></button></header>
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
  return <Suspense fallback={<main className="canvas-shell" />}><ReactFlowProvider><WorkflowCanvas /></ReactFlowProvider></Suspense>;
}
