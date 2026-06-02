import type { Metadata } from "next";
import "./globals.css";
import "./workflow.css";
import "@xyflow/react/dist/style.css";

export const metadata: Metadata = {
  title: "Agnes Studio",
  description: "AI 图片与视频生成工作台",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
