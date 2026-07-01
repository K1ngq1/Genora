import type { ReactNode } from "react";
import type { IconName } from "./workspace-types";

export function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    text: <path d="M5 6V4h14v2M12 4v16m-4 0h8" />,
    image: (
      <>
        <rect width="18" height="16" x="3" y="4" rx="3" />
        <circle cx="8.5" cy="9" r="1.5" />
        <path d="m21 15-5-5L5 20" />
      </>
    ),
    video: (
      <>
        <rect width="14" height="12" x="3" y="6" rx="3" />
        <path d="m17 10 4-2v8l-4-2" />
      </>
    ),
    spark: <path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8Z" />,
    plus: <path d="M12 5v14m-7-7h14" />,
    close: <path d="M18 6 6 18M6 6l12 12" />,
    upload: (
      <>
        <path d="M12 16V4m0 0L8 8m4-4 4 4" />
        <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5M12 7v5l3 2" />
      </>
    ),
    send: <path d="m22 2-7 20-4-9-9-4Z" />,
    map: <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15" />,
    grid: (
      <>
        <path d="M4 4h16v16H4z" />
        <path d="M4 10h16M4 16h16M10 4v16M16 4v16" />
      </>
    ),
    fit: (
      <>
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3" />
      </>
    ),
    settings: (
      <>
        <path d="M4 7h10m4 0h2M4 17h2m4 0h10" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="8" cy="17" r="2" />
      </>
    ),
    bulb: (
      <>
        <path d="M9 18h6M10 22h4" />
        <path d="M8 14a6 6 0 1 1 8 0c-1.2.9-1.7 1.8-1.8 3H9.8c-.1-1.2-.6-2.1-1.8-3Z" />
      </>
    ),
    camera: (
      <>
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
        <circle cx="12" cy="13" r="3" />
      </>
    ),
    stop: <rect x="8" y="8" width="8" height="8" rx="1.5" />,
    "arrow-up": <path d="M12 19V5m0 0-6 6m6-6 6 6" />,
    folder: <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z" />,
    chat: <path d="M5 6.5h14a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2Z" />,
    layers: (
      <>
        <path d="m12 3 8 4.5-8 4.5-8-4.5Z" />
        <path d="m4 12 8 4.5 8-4.5M4 16.5 12 21l8-4.5" />
      </>
    ),
    ellipsis: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    copy: <path d="M8 8h10v10H8zM6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />,
    trash: <path d="M4 7h16m-10 4v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" />,
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}
