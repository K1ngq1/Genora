export function combineGenerationPrompts(prompt: string, negativePrompt?: string) {
  const positive = prompt.trim();
  const negative = negativePrompt?.trim();
  if (!negative) return positive;
  return `${positive}\n\nAvoid the following elements: ${negative}`;
}
