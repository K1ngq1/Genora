import { readFile } from "node:fs/promises";

const home = await readFile("app/page.tsx", "utf8");
const css = await readFile("app/home.css", "utf8");
const workflowCss = await readFile("app/workflow.css", "utf8");

const modelPickerIndex = home.indexOf("home-model-picker");
const ratioIndex = home.indexOf("home-ratio-select");
const resolutionIndex = home.indexOf("home-resolution-select");
const settingsIndex = home.indexOf('href="/settings"');
const bottomIndex = home.indexOf("home-sidebar-bottom");

const checks = [
  ["collapsed sidebar state", home.includes("sidebarCollapsed")],
  ["sidebar defaults collapsed", home.includes("useState(true)")],
  ["left navigation shell", home.includes('className={`home-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}')],
  ["collapsed labels use hover tooltip", home.includes("data-label=") && css.includes(".home-sidebar.collapsed .logo-button[data-label]:hover:after")],
  ["collapsed text hidden", css.includes(".home-sidebar.collapsed .logo-button span{display:none}")],
  ["expanded sidebar width increased", css.includes("width:236px") && css.includes("margin-left:236px")],
  ["dark home surface", css.includes("background:#070708") && css.includes(".home-sidebar{") && css.includes("background:#0b0b0d")],
  ["black glass genora mark", home.includes("GenoraMark") && css.includes(".genora-mark") && css.includes("grayscale(1)")],
  ["sidebar home link", home.includes('href="/"') && home.includes("首页")],
  ["database link removed", !home.includes('href="/database"')],
  ["settings moved to bottom", settingsIndex > bottomIndex && bottomIndex > -1],
  ["collapse arrow button", home.includes('name={sidebarCollapsed ? "chevron-right" : "chevron-left"}') && css.includes(".home-collapse svg{width:16px;height:16px")],
  ["sidebar workspace link", home.includes('href="/projects"') && home.includes("工作空间")],
  ["sidebar symbolic icons", home.includes('name="home"') && home.includes('name="settings"') && home.includes('name="nodes"')],
  ["mouse reactive dot grid", home.includes("updateGridGlow") && home.includes("--grid-x") && css.includes(".home-grid:after")],
  ["no top header nav", !home.includes("home-header") && !home.includes("home-actions")],
  ["no featured recommendations", !home.includes("精选推荐") && !home.includes("featured-grid")],
  ["empty stage", home.includes("home-stage") && home.includes("今天要做点什么？")],
  ["bottom centered composer", home.includes("home-composer-dock") && css.includes(".home-composer-dock")],
  ["image generation mode", home.includes("图像生成")],
  ["video generation mode", home.includes("视频生成")],
  ["prompt hint area", home.includes("home-composer-hint") && css.includes(".home-composer-hint")],
  ["upload above composer", home.includes("home-upload-strip") && !home.includes("upload-tile")],
  ["model picker in composer footer", home.includes("home-model-picker") && home.includes("modelMenuOpen")],
  ["ratio placed after model picker", modelPickerIndex > -1 && ratioIndex > modelPickerIndex],
  ["resolution placed after ratio", ratioIndex > -1 && resolutionIndex > ratioIndex],
  ["footer controls group", home.includes("home-footer-controls") && css.includes(".home-footer-controls")],
  ["model catalog reuse", home.includes("modelsForKind") && home.includes("MODEL_CATALOG")],
  ["motion direction options", home.includes("MOTION_PRESETS") && home.includes("home-video-options")],
  ["upload image input", home.includes('type="file"') && home.includes('accept="image/*"')],
  ["video credit shown by submit", home.includes("estimateCredits") && home.includes("home-credit-pill")],
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
