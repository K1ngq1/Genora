import { generateAgnesText, isAgnesConfigured } from "@/lib/agnes";
import { AppError, errorResponse } from "@/lib/error-codes";
import { checkGenerateRateLimit } from "@/lib/rate-limit";
import { promptLengthResponse } from "@/lib/payload-limits";

type StoryboardShot = {
  id: string;
  shotNumber: string;
  visual: string;
  cameraMotion: string;
  duration: number;
  videoPrompt: string;
};

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced ?? text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new AppError("INVALID_JSON_RESPONSE", 502);
  return candidate.slice(start, end + 1);
}

function cleanText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeShot(value: unknown, index: number): StoryboardShot | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const visual = cleanText(item.visual ?? item.description ?? item.scene);
  const videoPrompt = cleanText(item.videoPrompt ?? item.prompt, visual);
  if (!visual || !videoPrompt) return null;
  const durationValue = Number(item.duration ?? item.durationSeconds ?? 5);
  const duration = Number.isFinite(durationValue) ? Math.min(20, Math.max(1, Math.round(durationValue))) : 5;
  return {
    id: cleanText(item.id, `shot-${index + 1}`) || `shot-${index + 1}`,
    shotNumber: cleanText(item.shotNumber ?? item.number, String(index + 1)),
    visual,
    cameraMotion: cleanText(item.cameraMotion ?? item.motion, "Natural camera motion"),
    duration,
    videoPrompt,
  };
}

export async function POST(request: Request) {
  const limited = checkGenerateRateLimit(request);
  if (limited) return limited;
  if (!isAgnesConfigured("text")) {
    return errorResponse(new AppError("MISSING_AGNES_API_KEY", 503), 503);
  }
  const body = await request.json();
  const sourceText = String(body.text ?? body.prompt ?? "").trim();
  if (!sourceText) return errorResponse(new AppError("EMPTY_TEXT_PROMPT", 400), 400);
  const tooLong = promptLengthResponse(sourceText);
  if (tooLong) return tooLong;

  const prompt = [
    "You are a storyboard planner for short AI-generated videos.",
    "Convert the user's text into 3 to 8 storyboard shots.",
    "Return JSON only. Do not include markdown or commentary.",
    "Schema: {\"storyboardShots\":[{\"shotNumber\":\"1\",\"visual\":\"...\",\"cameraMotion\":\"...\",\"duration\":5,\"videoPrompt\":\"English cinematic video generation prompt\"}]}",
    "Keep each videoPrompt specific, visual, and ready for text-to-video generation.",
    "",
    sourceText,
  ].join("\n");

  try {
    const result = await generateAgnesText(prompt);
    const parsed = JSON.parse(extractJson(result)) as { storyboardShots?: unknown[]; shots?: unknown[] };
    const rawShots = Array.isArray(parsed.storyboardShots) ? parsed.storyboardShots : parsed.shots;
    const storyboardShots = (rawShots ?? []).map(normalizeShot).filter((shot): shot is StoryboardShot => Boolean(shot));
    if (!storyboardShots.length) throw new AppError("INVALID_JSON_RESPONSE", 502);
    return Response.json({ storyboardShots });
  } catch (error) {
    if (error instanceof AppError) return errorResponse(error, error.status);
    return errorResponse(new AppError("INVALID_JSON_RESPONSE", 502), 502);
  }
}
