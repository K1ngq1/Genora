import { readFile } from "node:fs/promises";

const css = await readFile("app/workflow.css", "utf8");

const checks = [
  ["blank canvas uses pointer cursor", css.includes(".canvas-shell .react-flow__pane{cursor:default!important}")],
  ["node uses pointer cursor", css.includes(".canvas-shell .react-flow__node{width:auto;cursor:default!important}")],
  ["pressed node uses grabbing cursor", css.includes(".canvas-shell .react-flow__node:active{cursor:grabbing!important}")],
  ["blank canvas does not use grab cursor", !css.includes(".canvas-shell .react-flow__pane{cursor:grab}")],
];

const failed = checks.filter(([, passed]) => !passed);
if (failed.length) {
  for (const [name] of failed) console.error(`Missing: ${name}`);
  process.exit(1);
}

console.log("Canvas cursor checks passed.");
