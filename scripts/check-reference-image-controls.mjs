import { readFile } from "node:fs/promises";

const page = await readFile("app/page.tsx", "utf8");
const css = await readFile("app/workflow.css", "utf8");

const checks = [
  ["start image remove control", page.includes('aria-label="删除首帧图片"')],
  ["end image remove control", page.includes('aria-label="删除尾帧图片"')],
  ["persistent add image control", page.includes('aria-label="添加参考图片"')],
  ["add image uses plus icon", /className="frame-add"[\s\S]{0,160}<Icon name="plus" \/>/.test(page)],
  ["add image text removed", !page.includes("<span>添加图片</span>")],
  ["end frame picker", page.includes("const endFramePicker = useRef<HTMLInputElement>(null)")],
  ["remove button styling", css.includes(".frame-remove")],
  ["add button styling", css.includes(".frame-add")],
  ["prompt panel centered", css.includes("left:50%") && css.includes("translate(-50%,-5px)")],
  ["prompt panel stays centered when visible", !css.includes("transform:translateY(0)")],
];

const failed = checks.filter(([, passed]) => !passed);
if (failed.length) {
  for (const [name] of failed) console.error(`Missing: ${name}`);
  process.exit(1);
}

console.log("Reference image control checks passed.");
