import type React from "react";
import { HOME_LOGO } from "@/features/home/home-options";

export type IconName =
  | "home"
  | "settings"
  | "nodes"
  | "user"
  | "logout"
  | "mic"
  | "image"
  | "upload"
  | "spark"
  | "send"
  | "plus"
  | "box"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right";

export function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-8.5Z" />,
    settings: (
      <>
        <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
        <path d="M19 13.5v-3l-2.1-.5-.8-1.8 1.1-1.9-2.1-2.1-1.9 1.1-1.8-.8L10 2H7l-.5 2.1-1.8.8-1.9-1.1-2.1 2.1 1.1 1.9-.8 1.8L1 10v3l2.1.5.8 1.8-1.1 1.9 2.1 2.1 1.9-1.1 1.8.8L10 22h3l.5-2.1 1.8-.8 1.9 1.1 2.1-2.1-1.1-1.9.8-1.8 2-.5Z" />
      </>
    ),
    nodes: (
      <>
        <rect x="3" y="4" width="6" height="6" rx="1.5" />
        <rect x="15" y="4" width="6" height="6" rx="1.5" />
        <rect x="9" y="15" width="6" height="6" rx="1.5" />
        <path d="M9 7h6M12 10v5" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    logout: <path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" />,
    mic: (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <circle cx="8" cy="10" r="1.5" />
        <path d="m21 15-4.5-4.5L7 19" />
      </>
    ),
    upload: <path d="M12 16V4m0 0L8 8m4-4 4 4M5 16v3h14v-3" />,
    spark: <path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8Z" />,
    send: <path d="m22 2-7 20-4-9-9-4Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    box: (
      <>
        <path d="m12 3 7 4v8l-7 4-7-4V7Z" />
        <path d="m5 7 7 4 7-4M12 11v8" />
      </>
    ),
    "chevron-down": <path d="m6 9 6 6 6-6" />,
    "chevron-left": <path d="m15 18-6-6 6-6" />,
    "chevron-right": <path d="m9 18 6-6-6-6" />,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

export function GenoraMark({ className = "" }: { className?: string }) {
  return (
    <i className={`genora-mark ${className}`}>
      <img src={HOME_LOGO} alt="" />
    </i>
  );
}
