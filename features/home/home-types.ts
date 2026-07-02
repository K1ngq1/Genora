import type { CanvasRatio, CanvasResolution } from "@/lib/model-catalog";
import type { TaskStatus as KnownTaskStatus } from "@/lib/task-status";
import type { HomeMode } from "@/features/home/home-options";

export type TaskStatus = KnownTaskStatus | string;

export type HomeTask = {
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

export type HomeMessage =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "task"; task: HomeTask };

export type HomeChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: HomeMessage[];
  mode: HomeMode;
  model: string;
  aspectRatio: CanvasRatio;
  quality: CanvasResolution;
  duration?: number;
  motionPreset?: string;
  outputs: string[];
};
