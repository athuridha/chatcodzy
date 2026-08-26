"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { APP_NAME } from "@/lib/constants";

export function AppShell({ children }: { children: ReactNode }): React.JSX.Element {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <AuthGuard>
      <div
        className={cn(
          "min-h-[100dvh] bg-background transition-all duration-300",
          sidebarCollapsed
            ? "md:grid md:grid-cols-[64px_1fr]"
            : "md:grid md:grid-cols-[260px_1fr]"
        )}
      >
        {/* Sidebar desktop (single border handled inside Sidebar) */}
        <aside
          className={cn(
            "hidden h-[100dvh] md:block transition-all duration-300 overflow-hidden",
            sidebarCollapsed ? "w-[64px]" : "w-[260px]"
          )}
        >
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          />
        </aside>

        {/* Drawer mobile */}
        {drawerOpen && (
          <>
            <button
              aria-label="Tutup menu"
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs md:hidden"
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-[260px] bg-card border-r border-border shadow-2xl md:hidden">
              <Sidebar onNavigate={() => setDrawerOpen(false)} />
            </aside>
          </>
        )}

        <div className="flex h-[100dvh] min-h-0 flex-col relative">
          {/* Topbar mobile */}
          <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-2.5 backdrop-blur md:hidden">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Buka menu"
              onClick={() => setDrawerOpen(true)}
              className="h-8 w-8 rounded-lg"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold tracking-tight uppercase text-foreground">
              {APP_NAME}
            </span>
          </header>

          <main className="min-h-0 flex-1 flex flex-col">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
