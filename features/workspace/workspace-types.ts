import type { Edge, Node } from "@xyflow/react";
import type { CanvasRatio, CanvasResolution } from "@/lib/model-catalog";
import type { VideoGenerationMode } from "@/lib/video-model-capabilities";

export type Kind = "text" | "image" | "video" | "media-image" | "media-video" | "group";
export type Ratio = CanvasRatio;
export type Quality = CanvasResolution;
export type MotionPreset = "auto" | "push-in" | "pull-out" | "pan-left" | "pan-right" | "tilt-up" | "orbit-left" | "orbit-right" | "low-angle" | "top-down";
export type ThemeTone = "dark" | "light";
export type IconName =
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
  | "camera"
  | "stop"
  | "arrow-up"
  | "folder"
  | "chat"
  | "layers"
  | "ellipsis"
  | "chevron"
  | "copy"
  | "trash";

export type StoredWorkData = {
  kind: Kind;
  title: string;
  prompt: string;
  ratio: Ratio;
  quality: Quality;
  model?: string;
  videoMode?: VideoGenerationMode;
  motionPreset?: MotionPreset;
  duration: number;
  settingsOpen?: boolean;
  negativePrompt?: string;
  negativePromptOpen?: boolean;
  url?: string;
  startFrameUrl?: string;
  startFrameName?: string;
  endFrameUrl?: string;
  endFrameName?: string;
  referenceFrameUrls?: string[];
  referenceFrameNames?: string[];
  result?: string;
  taskId?: string;
  busy?: boolean;
  error?: string;
  canResume?: boolean;
  lastProviderStatus?: string | null;
  selectionSuppressed?: boolean;
  hasImageInput?: boolean;
  actualCredits?: number | null;
};

export type RuntimeNodeActions = {
  uploadAsset: (file: File) => Promise<string>;
  update: (id: string, patch: Partial<StoredWorkData>) => void;
  remove: (id: string) => void;
  generate: (id: string) => void;
};
export type WorkData = StoredWorkData & RuntimeNodeActions;

export type WorkNode = Node<WorkData, "work">;
export type DeletedCanvasEntry = { nodes: WorkNode[]; edges: Edge[] };
export type StoredWorkNode = Omit<WorkNode, "data"> & { data: StoredWorkData };
export type MaterialLibraryItem = {
  id: string;
  name: string;
  kind: "image" | "video" | "node" | "group" | "folder";
  folderId?: string | null;
  url?: string;
  nodes?: StoredWorkNode[];
  edges?: Edge[];
  createdAt: string;
};
export type LibraryTreeItem = { item: MaterialLibraryItem; depth: number };
export type LibraryMenuState = { id: string; screen: { x: number; y: number }; mode: "actions" | "move" };
export type MenuState = { screen: { x: number; y: number }; flow: { x: number; y: number }; sourceId?: string };
export type NodeContextMenuState = { screen: { x: number; y: number }; flow: { x: number; y: number }; nodeId: string };
export type CanvasClipboard = { nodes: StoredWorkNode[]; edges: Edge[] };
export type AgentMessage = { role: "user" | "assistant"; content: string; error?: boolean };
export type AgentAttachment = { id: string; kind: "image" | "video"; name: string; url: string; dataUrl?: string };
export type AgentToolCall = { id: string; function: { name: string; arguments: string } };
export type AgentTool = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };
export type CanvasProject = {
  id: string;
  name: string;
  requiresRename: boolean;
  canvasData: {
    nodes: StoredWorkNode[];
    edges: Edge[];
    viewport: { x: number; y: number; zoom: number };
    libraryItems: MaterialLibraryItem[];
  };
};
export type SaveStatus = "loading" | "unsaved" | "saving" | "saved" | "error";
