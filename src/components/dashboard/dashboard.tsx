import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";

import { FlintMark } from "@/components/brand";
import {
  MobileMenuRow,
  SidebarMenu,
} from "@/components/dashboard/dashboard-menu";

/**
 * Dashboard shell: top bar + icon-ed menu. The health gate lives in the
 * route layout, so every `/dashboard/*` page is protected; each page fills
 * the content area itself.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur-md">
        <div className="flex h-16 items-center gap-3 px-5 sm:px-8">
          <FlintMark className="size-3.5 text-accent-bright" />
          <span className="font-mono text-[14.5px] text-ink-soft">flint</span>
          <span className="font-mono text-[14.5px] text-faint">
            / dashboard
          </span>

          <span className="ml-auto flex items-center gap-2 font-mono text-[12.5px] text-completed">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-2 animate-ping rounded-full bg-completed opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-completed" />
            </span>
            ready
          </span>

          <Link
            href="/"
            className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[14px] font-medium text-white/70 transition-colors hover:border-white/20 hover:text-white sm:inline-flex"
          >
            Landing page
            <ArrowUpRight className="size-3.5" weight="bold" />
          </Link>
        </div>
      </header>

      <MobileMenuRow />

      <div className="mx-auto w-full max-w-[1420px] flex-1">
        <div className="flex">
          <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-line px-4 py-9 lg:block">
            <SidebarMenu />
          </aside>
          <div className="min-w-0 flex-1 px-5 py-10 sm:px-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
