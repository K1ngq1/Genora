import { AppError, errorResponse } from "@/lib/error-codes";

// Generous ceiling for creative prompts: large enough for detailed multi-shot
// prompts but small enough to block abuse. Per-file upload caps in the routes
// (MAX_UPLOAD / MAX_REFERENCE_SIZE) already bound total payload bytes for
// multipart submissions, so this helper focuses on the uniform prompt-length
// guard shared by every generate endpoint.
export const MAX_PROMPT_LENGTH = 4_000;
export const MAX_REFERENCE_IMAGES = 16;

/** Returns null when the prompt is within bounds, otherwise a 400 Response. */
export function promptLengthResponse(prompt: string): Response | null {
  if (prompt.length <= MAX_PROMPT_LENGTH) return null;
  return errorResponse(new AppError("PROMPT_TOO_LONG", 400), 400);
}
