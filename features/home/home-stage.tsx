import { MODEL_COUNT } from "@/features/home/home-options";
import { GenoraMark } from "@/features/home/home-icons";
import { HomeTaskCard } from "@/features/home/home-task-card";
import type { HomeMessage } from "@/features/home/home-types";

type HomeStageProps = {
  hasGeneration: boolean;
  messages: HomeMessage[];
};

export function HomeStage({ hasGeneration, messages }: HomeStageProps) {
  return (
    <section className="home-stage" aria-label="对话区域">
      {!hasGeneration && (
        <div className="home-stage-empty">
          <GenoraMark className="stage-mark" />
          <h1 className="home-shell-title">今天要做点什么？</h1>
          <span>已接入 {MODEL_COUNT} 个创作模型</span>
        </div>
      )}
      {messages.map((message) => (
        message.role === "user" ? (
          <article key={message.id} className="home-message user">{message.content}</article>
        ) : (
          <HomeTaskCard key={message.id} task={message.task} />
        )
      ))}
    </section>
  );
}
