import { modeLabel, optionLabel, statusLabel } from "@/features/home/home-options";
import type { HomeTask } from "@/features/home/home-types";

type HomeTaskCardProps = {
  task: HomeTask;
};

export function HomeTaskCard({ task }: HomeTaskCardProps) {
  return (
    <article className={`home-task-card ${task.kind} ${task.status}`}>
      <header>
        <span>{modeLabel(task.kind)}</span>
        <b>{statusLabel(task.status)}</b>
      </header>
      <p>{task.prompt}</p>
      {task.outputUrl && task.kind === "image" && <img src={task.outputUrl} alt={task.prompt} />}
      {task.outputUrl && task.kind === "video" && <video src={task.outputUrl} controls />}
      {task.error && <em>{task.error}</em>}
      <footer>
        <span>{task.model}</span>
        <span>{task.ratio}</span>
        <span>{optionLabel(task.resolution)}</span>
        {task.duration && <span>{task.duration} 秒</span>}
      </footer>
    </article>
  );
}
