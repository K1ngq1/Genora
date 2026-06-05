import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { AppError } from "@/lib/error-codes";

export type IdeogramModel = "ideogram-4-nf4" | "ideogram-4-fp8";

const MODEL_TO_QUANTIZATION: Record<IdeogramModel, "nf4" | "fp8"> = {
  "ideogram-4-nf4": "nf4",
  "ideogram-4-fp8": "fp8",
};

function pythonCommand() {
  return (process.env.IDEOGRAM_PYTHON?.trim() || "python").replace(/^["']|["']$/g, "");
}

function ideogramDir() {
  return path.join(process.cwd(), "vendor", "ideogram4");
}

function compactProcessOutput(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 700);
}

async function hasCuda() {
  const result = await new Promise<{ code: number | null; stdout: string }>((resolve) => {
    const child = spawn(pythonCommand(), ["-c", "import torch; print('1' if torch.cuda.is_available() else '0')"], {
      cwd: process.cwd(),
      env: process.env,
      windowsHide: true,
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.on("error", () => resolve({ code: 1, stdout: "" }));
    child.on("close", (code) => resolve({ code, stdout }));
  });
  return result.code === 0 && result.stdout.trim() === "1";
}

export function isIdeogramModel(value: string): value is IdeogramModel {
  return value === "ideogram-4-nf4" || value === "ideogram-4-fp8";
}

export async function generateIdeogramImage(options: {
  prompt: string;
  model: IdeogramModel;
  width: number;
  height: number;
  seed?: number;
}) {
  if (!process.env.HF_TOKEN?.trim() && !process.env.HUGGING_FACE_HUB_TOKEN?.trim()) {
    throw new AppError("IDEOGRAM_MISSING_HF_TOKEN", 503);
  }
  if (options.model === "ideogram-4-nf4" && !(await hasCuda())) {
    throw new AppError("IDEOGRAM_NF4_REQUIRES_CUDA", 503);
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "genora-ideogram-"));
  const output = path.join(tempDir, "output.png");
  const args = [
    "run_inference.py",
    "--prompt",
    options.prompt,
    "--output",
    output,
    "--width",
    String(options.width),
    "--height",
    String(options.height),
    "--quantization",
    MODEL_TO_QUANTIZATION[options.model],
    "--sampler-preset",
    process.env.IDEOGRAM_SAMPLER_PRESET?.trim() || "V4_DEFAULT_20",
    "--seed",
    String(Number.isFinite(options.seed) ? options.seed : 0),
  ];

  if (process.env.IDEOGRAM_API_KEY?.trim() || process.env.MAGIC_PROMPT_API_KEY?.trim()) {
    args.push("--magic-prompt-key", process.env.MAGIC_PROMPT_API_KEY?.trim() || process.env.IDEOGRAM_API_KEY!.trim());
  } else {
    args.push("--no-magic-prompt");
  }

  const result = await new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
    const child = spawn(pythonCommand(), args, {
      cwd: ideogramDir(),
      env: process.env,
      windowsHide: true,
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      reject(new AppError("IDEOGRAM_NOT_INSTALLED", 503, error.message));
    });
    child.on("close", (code) => resolve({ code, stderr }));
  });

  if (result.code !== 0) {
    const detail = compactProcessOutput(result.stderr);
    if (/GatedRepoError|401|403|404|not authorized|restricted/i.test(detail)) {
      throw new AppError("IDEOGRAM_MODEL_ACCESS_DENIED", 503, detail);
    }
    if (/No module named|ModuleNotFoundError|ImportError/i.test(detail)) {
      throw new AppError("IDEOGRAM_NOT_INSTALLED", 503, detail);
    }
    throw new AppError("IDEOGRAM_INFERENCE_FAILED", 502, detail);
  }

  return readFile(output);
}
