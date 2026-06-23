import fs from "node:fs";

const page = fs.readFileSync("app/workspace/page.tsx", "utf8");
const css = fs.readFileSync("app/workflow.css", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(page.includes('className="home-fab"'), "top-left home entry should exist");
assert(page.includes('href="/"'), "home entry should return to the homepage");
assert(page.includes("selectionSuppressed"), "selected nodes should be able to suppress prompt panels");
assert(page.includes("selectionAction"), "selection action overlay should be computed");
assert(page.includes("selection-action-pop"), "selection action overlay should render above the selection");
assert(page.includes('className="model-trigger model-trigger-logo"'), "model trigger should show model logo plus model name");
assert(page.includes("selectedModel.label"), "model trigger should keep the selected model name visible");
assert(page.includes('className="node-result-card video-generating"'), "video generation card should keep the icon and use a dedicated generating UI");
assert(page.includes("selection-library-button"), "selection overlay should include save-to-library action");
assert(page.includes("selection-group-button"), "selection overlay should include group action");
assert(page.includes('className="generate-button-submit"'), "prompt submit should use the compact credit plus arrow button");

assert(css.includes(".canvas-node.selection-suppressed .prompt-pop"), "prompt panel should be hidden during box selection");
assert(css.includes(".selection-action-pop"), "selection action overlay should be styled");
assert(!css.includes(".canvas-node:hover .prompt-pop"), "prompt panel must not open only from hovering a node");
assert(css.includes("animation:none"), "agent/home logo should not rotate");
assert(css.includes(".home-fab{display:grid;place-items:center;flex:0 0 auto;width:44px;height:44px;border:0;border-radius:0;background:transparent;box-shadow:none"), "home logo should not have a visible background frame");
assert(css.includes(".home-fab img{width:38px;height:38px"), "home logo should be enlarged");
assert(css.includes("--canvas-visual-scale:.6"), "main canvas visual scale should be about 60%");
assert(!css.includes(".canvas-shell .react-flow__viewport{zoom:"), "React Flow viewport should not use CSS zoom because it breaks selection and double-click coordinates");
assert(css.includes("width:190px!important;height:112px!important"), "minimap should keep its original size");
assert(css.includes(".canvas-shell .react-flow__minimap{left:24px!important;bottom:88px!important"), "minimap should sit above the bottom slider controls");
assert(css.includes(".node-result-card .text-result{font-size:14px;color:#ffffff"), "text node result should use white text");
assert(css.includes(".canvas-shell>.topbar{top:22px;left:32px;right:32px;padding-left:8px}"), "workspace topbar should have optimized boundary spacing");

console.log("canvas selection and home UI checks passed");
