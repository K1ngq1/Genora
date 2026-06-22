"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import "./projects.css";

type ProjectSummary = {
  id: string;
  name: string;
  nodeCount: number;
  requiresRename: boolean;
  updatedAt: string;
  lastOpenedAt: string;
};

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string>();
  const [deletingProject, setDeletingProject] = useState<ProjectSummary>();
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/projects", { cache: "no-store" });
      if (!response.ok) throw new Error("LOAD_FAILED");
      setProjects(await readJson(response));
      setError("");
    } catch {
      setError("作品库加载失败，请刷新重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadProjects(); }, [loadProjects]);

  const createProject = async () => {
    const response = await fetch("/api/projects", { method: "POST" });
    if (!response.ok) return setError("新建项目失败");
    const project = await readJson(response) as ProjectSummary;
    window.localStorage.setItem("genora-current-project", project.id);
    router.push(`/?project=${encodeURIComponent(project.id)}`);
  };

  const startRename = (project: ProjectSummary) => {
    setEditingId(project.id);
    setName(project.name === "empty space" ? "" : project.name);
  };

  const renameProject = async () => {
    const nextName = name.trim();
    if (!editingId || !nextName || nextName.toLowerCase() === "empty space") {
      return setError("请输入新的项目名称");
    }
    const response = await fetch(`/api/projects/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nextName }),
    });
    if (!response.ok) return setError("重命名失败");
    setEditingId(undefined);
    setName("");
    setError("");
    await loadProjects();
  };

  const deleteProject = async () => {
    if (!deletingProject || deleteBusy) return;
    setDeleteBusy(true);
    try {
      const response = await fetch(`/api/projects/${deletingProject.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("DELETE_FAILED");
      if (window.localStorage.getItem("genora-current-project") === deletingProject.id) {
        window.localStorage.removeItem("genora-current-project");
      }
      setProjects((items) => items.filter((project) => project.id !== deletingProject.id));
      setDeletingProject(undefined);
      setError("");
    } catch {
      setError("项目删除失败，请稍后重试");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <main className="projects-page">
      <header className="projects-header">
        <div>
          <Link href="/" className="projects-back">← 返回画布</Link>
          <p>Genora Project Library</p>
          <h1>作品库</h1>
          <span>打开已保存的创作空间，或从 empty space 开始新项目。</span>
        </div>
      </header>

      {error && <div className="projects-error">{error}</div>}

      <section className="projects-grid" aria-busy={loading}>
        {loading && <div className="projects-empty">正在加载作品…</div>}
        {!loading && (
          <button className="project-create-card" onClick={createProject}>
            <span className="project-create-plus">+</span>
            <b>新建项目</b>
            <small>创建 empty space</small>
          </button>
        )}
        {projects.map((project) => (
          <article className="project-card" key={project.id}>
            <Link
              className="project-preview"
              href={`/?project=${encodeURIComponent(project.id)}`}
              onClick={() => window.localStorage.setItem("genora-current-project", project.id)}
            >
              <span className="project-orb" />
              <span className="project-node one" />
              <span className="project-node two" />
              <span className="project-node three" />
              <small>{project.nodeCount} 个节点</small>
            </Link>
            <div className="project-card-body">
              <div>
                <h2>{project.name}</h2>
                <p>{project.requiresRename ? "等待重新命名" : `更新于 ${formatDate(project.updatedAt)}`}</p>
              </div>
              <div className="project-card-actions">
                <button aria-label={`重命名 ${project.name}`} onClick={() => startRename(project)}>重命名</button>
                <button className="danger" aria-label={`删除 ${project.name}`} onClick={() => setDeletingProject(project)}>删除</button>
              </div>
            </div>
          </article>
        ))}
      </section>

      {editingId && (
        <div className="projects-modal-backdrop" onMouseDown={() => setEditingId(undefined)}>
          <section className="projects-modal" onMouseDown={(event) => event.stopPropagation()}>
            <h2>重命名项目</h2>
            <input
              autoFocus
              value={name}
              maxLength={80}
              placeholder="输入项目名称"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") void renameProject(); }}
            />
            <div>
              <button onClick={() => setEditingId(undefined)}>取消</button>
              <button className="primary" onClick={() => void renameProject()}>保存名称</button>
            </div>
          </section>
        </div>
      )}

      {deletingProject && (
        <div className="projects-modal-backdrop" onMouseDown={() => { if (!deleteBusy) setDeletingProject(undefined); }}>
          <section className="projects-modal delete-modal" onMouseDown={(event) => event.stopPropagation()}>
            <h2>确认删除项目</h2>
            <p>“{deletingProject.name}”将从作品库中永久移除，此操作无法撤销。</p>
            <div>
              <button disabled={deleteBusy} onClick={() => setDeletingProject(undefined)}>取消</button>
              <button className="danger-confirm" disabled={deleteBusy} onClick={() => void deleteProject()}>
                {deleteBusy ? "正在删除…" : "确认删除"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
