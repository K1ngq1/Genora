import type { ModelDeveloper, ModelProvider } from "./model-catalog";

type LogoKey = ModelDeveloper | ModelProvider | "fallback";

export type ProviderLogoEntry = {
  label: string;
  src: string | null;
};

export const providerLogoMap: Record<LogoKey, ProviderLogoEntry> = {
  agnes: { label: "Agnes", src: "/assets/genora-logo.png" },
  google: { label: "Google / Gemini", src: null },
  openai: { label: "OpenAI", src: null },
  bytedance: { label: "ByteDance", src: null },
  kling: { label: "Kling", src: null },
  happyhorse: { label: "HappyHorse", src: null },
  xai: { label: "xAI", src: null },
  apimart: { label: "APIMart", src: null },
  fallback: { label: "Model", src: null },
};

export function getProviderLogo(key?: string | null): ProviderLogoEntry {
  if (!key) return providerLogoMap.fallback;
  return providerLogoMap[key as LogoKey] ?? providerLogoMap.fallback;
}
