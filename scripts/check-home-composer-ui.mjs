import { readFile } from "node:fs/promises";

const home = await readFile("app/page.tsx", "utf8");
const css = await readFile("app/home.css", "utf8");
const workflowCss = await readFile("app/workflow.css", "utf8");

const checks = [
  ["collapsed sidebar state", home.includes("sidebarCollapsed")],
  ["left navigation shell", home.includes('className={`home-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}')],
  ["dark home surface", css.includes("background:#070708") && css.includes(".home-sidebar{") && css.includes("background:#0b0b0d")],
  ["sidebar home link", home.includes('href="/"') && home.includes("首页")],
  ["sidebar database link", home.includes('href="/database"') && home.includes("数据库")],
  ["sidebar settings link", home.includes('href="/settings"') && home.includes("设置")],
  ["sidebar workspace link", home.includes('href="/projects"') && home.includes("工作空间")],
  ["sidebar symbolic icons", home.includes('name="home"') && home.includes('name="folder"') && home.includes('name="settings"') && home.includes('name="nodes"')],
  ["no top header nav", !home.includes("home-header") && !home.includes("home-actions")],
  ["no featured recommendations", !home.includes("精选推荐") && !home.includes("featured-grid")],
  ["empty stage", home.includes("home-stage")],
  ["bottom centered composer", home.includes("home-composer-dock") && css.includes(".home-composer-dock")],
  ["image generation mode", home.includes("图像生成")],
  ["video generation mode", home.includes("视频生成")],
  ["home mode panel", home.includes("home-mode-panel")],
  ["headers removed from config cards", !home.includes("<header>") && !home.includes("homeCapabilityLabel(model)")],
  ["upload moved above composer", home.includes("home-upload-strip") && !home.includes("upload-tile")],
  ["model picker in composer footer", home.includes("home-model-picker") && home.includes("modelMenuOpen")],
  ["model catalog reuse", home.includes("modelsForKind") && home.includes("MODEL_CATALOG")],
  ["motion direction options", home.includes("MOTION_PRESETS")],
  ["upload image input", home.includes('type="file"') && home.includes('accept="image/*"')],
  ["credit shown by submit", home.includes("estimateCredits") && home.includes("home-credit-pill")],
  ["submit stays on home", home.includes("submitHomePrompt") && !home.includes("router.push(`/workspace")],
  ["speech recognition support", home.includes("SpeechRecognition") && home.includes("startVoiceInput") && home.includes('name="mic"')],
  ["agent API still used", home.includes("/api/agent/generate")],
  ["logo buttons", css.includes(".logo-button")],
  ["workspace agent logo uses same sizing", workflowCss.includes(".agent-fab img{width:38px;height:38px")],
];

const failed = checks.filter(([, passed]) => !passed);
if (failed.length) {
  for (const [name] of failed) console.error(`Missing: ${name}`);
  process.exit(1);
}

console.log("Home composer UI checks passed.");
