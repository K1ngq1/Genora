import { readFile } from "node:fs/promises";

const page = [
  await readFile("app/workspace/page.tsx", "utf8"),
  await readFile("features/workspace/workflow-node.tsx", "utf8"),
].join("\n");
const css = await readFile("app/workflow.css", "utf8");

const checks = [
  ["start frame upload slot", page.includes("data.startFrameUrl") && page.includes("start-frame-slot")],
  ["end frame upload slot", page.includes("data.endFrameUrl") && page.includes("end-frame-slot")],
  ["end frame gated by model capability", page.includes("selectedModel?.supportsEndFrame")],
  ["start image remove control", page.includes('aria-label="删除首帧图片"')],
  ["end image remove control", page.includes('aria-label="删除尾帧图片"')],
  ["reference add image control", page.includes('aria-label="添加参考图片"')],
  ["reference add image uses plus icon", /className="frame-add"[\s\S]{0,180}<Icon name="plus" \/>/.test(page)],
  ["end frame picker", page.includes("const endFramePicker = useRef<HTMLInputElement>(null)")],
  ["frame chip styling", css.includes(".frame-chip") && css.includes(".frame-chip-wrap")],
  ["remove button styling", css.includes(".frame-remove")],
  ["add button styling", css.includes(".frame-add")],
  ["prompt panel centered", css.includes("left:50%") && css.includes("translate(-50%,-5px)")],
  ["prompt panel stays centered when visible", css.includes("translate(-50%,0)")],
];

const failed = checks.filter(([, passed]) => !passed);
if (failed.length) {
  for (const [name] of failed) console.error(`Missing: ${name}`);
  process.exit(1);
}

console.log("Reference image control checks passed.");
