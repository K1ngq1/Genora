import type { Project } from "@prisma/client";

export type CanvasViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type CanvasProjectData = {
  nodes: unknown[];
  edges: unknown[];
  viewport: CanvasViewport;
  libraryItems: unknown[];
};

export const EMPTY_CANVAS_DATA: CanvasProjectData = {
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  libraryItems: [],
};

export function normalizeProjectName(value: unknown) {
  const name = String(value ?? "").trim();
  if (!name || name.toLowerCase() === "empty space") return null;
  return name.slice(0, 80);
}

export function parseCanvasData(value: unknown): CanvasProjectData {
  let data = value;
  if (typeof value === "string") {
    try {
      data = JSON.parse(value);
    } catch {
      return EMPTY_CANVAS_DATA;
    }
  }
  if (!data || typeof data !== "object") return EMPTY_CANVAS_DATA;
  const candidate = data as Partial<CanvasProjectData>;
  const viewport = candidate.viewport;
  return {
    nodes: Array.isArray(candidate.nodes) ? candidate.nodes : [],
    edges: Array.isArray(candidate.edges) ? candidate.edges : [],
    libraryItems: Array.isArray(candidate.libraryItems) ? candidate.libraryItems : [],
    viewport: viewport
      && Number.isFinite(viewport.x)
      && Number.isFinite(viewport.y)
      && Number.isFinite(viewport.zoom)
      ? { x: viewport.x, y: viewport.y, zoom: viewport.zoom }
      : EMPTY_CANVAS_DATA.viewport,
  };
}

export function publicProject(project: Project) {
  const canvasData = parseCanvasData(project.canvasData);
  return {
    id: project.id,
    name: project.name,
    canvasData,
    nodeCount: canvasData.nodes.length,
    requiresRename: project.requiresRename,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    lastOpenedAt: project.lastOpenedAt.toISOString(),
  };
}
