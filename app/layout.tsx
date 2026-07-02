import type { Metadata } from "next";
import "./globals.css";
import "./workflow.css";
import "@xyflow/react/dist/style.css";
import { AuthProvider } from "@/features/auth/auth-provider";
import { AuthDialog } from "@/features/auth/auth-dialog";

export const metadata: Metadata = {
  title: "Genora",
  description: "AI 图片与视频生成工作台",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>
          {children}
          <AuthDialog />
        </AuthProvider>
      </body>
    </html>
  );
}
