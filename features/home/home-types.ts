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
