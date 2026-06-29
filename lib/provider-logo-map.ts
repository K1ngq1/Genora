import type { ModelProvider } from "./model-catalog";

type LogoKey = ModelProvider | "fallback";

export type ProviderLogoEntry = {
  label: string;
  src: string | null;
};

export const providerLogoMap: Record<LogoKey, ProviderLogoEntry> = {
  agnes: { label: "Agnes", src: "/assets/genora-logo.png" },
  apimart: { label: "APIMart", src: null },
  fallback: { label: "Model", src: null },
};

export function getProviderLogo(key?: string | null): ProviderLogoEntry {
  if (!key) return providerLogoMap.fallback;
  return providerLogoMap[key as LogoKey] ?? providerLogoMap.fallback;
}
