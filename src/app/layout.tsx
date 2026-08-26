import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { JetBrains_Mono } from "next/font/google";

import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { APP_NAME } from "@/lib/constants";

import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: `${APP_NAME} — Asisten AI dengan Memori Permanen`,
  description:
    "Chatbot AI percakapan dengan memori jangka panjang. Ditenagai OpenRouter.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${jetbrainsMono.variable} font-sans min-h-[100dvh]`}
      >
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
