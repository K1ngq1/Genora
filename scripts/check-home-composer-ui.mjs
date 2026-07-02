import { readFile } from "node:fs/promises";

const home = await readFile("app/page.tsx", "utf8");
const homeOptions = await readFile("features/home/home-options.ts", "utf8");
const homeSidebar = await readFile("features/home/home-sidebar.tsx", "utf8");
const homeStage = await readFile("features/home/home-stage.tsx", "utf8");
const homeTaskCard = await readFile("features/home/home-task-card.tsx", "utf8");
const css = await readFile("app/home.css", "utf8");
const workflowCss = await readFile("app/workflow.css", "utf8");
const homeSurface = `${home}\n${homeSidebar}\n${homeStage}\n${homeTaskCard}`;

const modelPickerIndex = home.indexOf("home-model-picker");
const ratioIndex = home.indexOf("home-ratio-picker");
const resolutionIndex = home.indexOf("home-resolution-picker");
const motionIndex = home.indexOf("home-motion-picker");
const uploadIndex = home.indexOf("home-upload-strip");
const accountIndex = homeSurface.indexOf("home-user-button");
const bottomIndex = homeSurface.indexOf("home-sidebar-bottom");

const checks = [
  ["collapsed sidebar state", home.includes("sidebarCollapsed")],
  ["sidebar defaults collapsed", home.includes("useState(true)")],
  ["left navigation shell", homeSurface.includes("home-sidebar") && homeSurface.includes("collapsed")],
  ["collapsed labels use hover tooltip", homeSurface.includes("data-label=") && css.includes(".home-sidebar.collapsed .logo-button[data-label]:hover:after")],
  ["collapsed text hidden", css.includes(".home-sidebar.collapsed .logo-button span{display:none}")],
  ["expanded sidebar width increased", css.includes("width:236px") && css.includes("margin-left:236px")],
  ["dark home surface", css.includes("background:#070708") && css.includes(".home-sidebar{") && css.includes("background:#0b0b0d")],
  ["black glass genora mark", homeSurface.includes("GenoraMark") && css.includes(".genora-mark") && css.includes("grayscale(1)")],
  ["sidebar home link", homeSurface.includes('href="/"') && homeSurface.includes("??")],
  ["database link removed", !homeSurface.includes('href="/database"')],
  ["account moved to bottom", accountIndex > bottomIndex && bottomIndex > -1],
  ["logo toggles sidebar", homeSidebar.includes("home-sidebar-logo logo-button") && homeSidebar.includes("onToggleCollapsed")],
  ["collapsed chat bubble", homeSidebar.includes("home-chat-bubble") && homeSidebar.includes('name="chat"') && css.includes("homeBubbleFloat")],
  ["sidebar workspace link", homeSurface.includes('href="/projects"') && homeSurface.includes('name="nodes"')],
  ["sidebar symbolic icons", homeSurface.includes('name="home"') && homeSurface.includes('name="user"') && homeSurface.includes('name="nodes"')],
  ["mouse reactive dot grid", home.includes("updateGridGlow") && home.includes("--grid-x") && css.includes(".home-grid:after")],
  ["no top header nav", !home.includes("home-header") && !home.includes("home-actions")],
  ["no featured recommendations", !home.includes("精选推荐") && !home.includes("featured-grid")],
  ["empty stage", homeSurface.includes("home-stage") && homeSurface.includes("home-stage-empty")],
  ["compact media composer", homeSurface.includes("home-shell-title") && css.includes(".home-composer-dock.has-generation") && css.includes("min-height:72px")],
  ["image generation mode", home.includes("图像生成")],
  ["video generation mode", home.includes("视频生成")],
  ["only image and video modes", !home.includes("数字人") && !home.includes("动作模仿")],
  ["prompt hint area", home.includes("home-composer-hint") && css.includes(".home-composer-hint")],
  ["upload above composer", home.includes("home-upload-strip") && !home.includes("upload-tile")],
  ["model picker in composer footer", home.includes("home-model-picker") && home.includes("modelMenuOpen")],
  ["ratio placed after model picker", modelPickerIndex > -1 && ratioIndex > modelPickerIndex],
  ["resolution placed after ratio", ratioIndex > -1 && resolutionIndex > ratioIndex],
  ["native composer selects removed", !home.includes("<select") && !home.includes("home-ratio-select") && !home.includes("home-resolution-select")],
  ["capsule ratio picker", home.includes("home-ratio-picker") && home.includes("home-ratio-menu") && css.includes(".home-capsule-menu")],
  ["capsule resolution picker", home.includes("home-resolution-picker") && home.includes("home-resolution-menu")],
  ["footer controls group", home.includes("home-footer-controls") && css.includes(".home-footer-controls")],
  ["model catalog reuse", home.includes("@/features/home/home-options") && homeOptions.includes("modelsForKind") && homeOptions.includes("MODEL_CATALOG")],
  ["motion direction options", home.includes("MOTION_PRESETS") && home.includes("home-motion-menu")],
  ["motion direction before upload", motionIndex > -1 && uploadIndex > -1 && motionIndex < uploadIndex],
  ["upload image file retained", home.includes("imageFile") && home.includes("setImageFile")],
  ["real image generation API", home.includes('/api/images/generate') && !home.includes('/api/agent/generate')],
  ["real video generation API", home.includes('/api/videos/generate') && home.includes("new FormData()")],
  ["task polling", home.includes('/api/tasks/${taskId}') && home.includes("pollHomeTask")],
  ["home task result cards", homeSurface.includes("home-task-card") && homeSurface.includes("outputUrl") && homeSurface.includes("<video") && homeSurface.includes("<img")],
  ["generation layout state", home.includes("has-generation") && home.includes("hasGeneration")],
  ["submit stays on home", !home.includes("router.push(`/workspace")],
  ["speech recognition support", home.includes("SpeechRecognition") && home.includes("startVoiceInput") && home.includes('name="mic"')],
  ["logo buttons", css.includes(".logo-button")],
  ["workspace agent logo uses same sizing", workflowCss.includes(".agent-fab img{width:38px;height:38px")],
];

const failed = checks.filter(([, passed]) => !passed);
if (failed.length) {
  for (const [name] of failed) console.error(`Missing: ${name}`);
  process.exit(1);
}

console.log("Home composer UI checks passed.");
