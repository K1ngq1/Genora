// Probe: does Agnes /chat/completions support OpenAI-style tool/function calling?
// Temporary diagnostic script. Run: node --env-file=.env scripts/probe-agent-tools.mjs
// Safe: never prints the API key, only status / content / tool_calls.

// Prefer the fine-grained key the adapter actually uses; fall back to legacy single key.
const key = process.env.AGNES_1_5_FLASH_API_KEY || process.env.AGNES_API_KEY;
if (!key) {
  console.error("NO_KEY: set AGNES_1_5_FLASH_API_KEY (preferred) or AGNES_API_KEY in .env first.");
  process.exit(1);
}
console.log("Using key source:", process.env.AGNES_1_5_FLASH_API_KEY ? "AGNES_1_5_FLASH_API_KEY" : "AGNES_API_KEY");

const URL = "https://apihub.agnes-ai.com/v1/chat/completions";

async function call(label, body) {
  console.log(`\n===== ${label} =====`);
  const res = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  console.log("HTTP status:", res.status);
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    const choice = data.choices?.[0];
    const msg = choice?.message;
    console.log("finish_reason:", choice?.finish_reason ?? "(none)");
    console.log("message keys:", Object.keys(msg ?? {}));
    console.log("content:", JSON.stringify(msg?.content ?? null));
    console.log("tool_calls:", JSON.stringify(msg?.tool_calls ?? null));
    if (!res.ok) console.log("error body:", JSON.stringify(data).slice(0, 400));
  } catch {
    console.log("non-JSON response (first 400 chars):", text.slice(0, 400));
  }
}

await call("baseline WITHOUT tools", {
  model: "agnes-2.0-flash",
  messages: [{ role: "user", content: "回复两个字：你好" }],
});

await call("WITH tools + tool_choice auto", {
  model: "agnes-2.0-flash",
  messages: [{ role: "user", content: "请在画布上添加一个图像节点，提示词画一只猫" }],
  tools: [{
    type: "function",
    function: {
      name: "add_node",
      description: "在画布上添加一个生成节点，并设置提示词。",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["text", "image", "video"], description: "节点类型" },
          prompt: { type: "string", description: "生成提示词" },
        },
        required: ["kind"],
      },
    },
  }],
  tool_choice: "auto",
});

console.log("\nProbe done.");
