"use client";

import {
  CalendarBlank,
  Cpu,
  GearSix,
  ListBullets,
  Scroll,
  SealWarning,
  SquaresFour,
  TrashSimple,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Overview", icon: SquaresFour, exact: true },
  { href: "/dashboard/jobs", label: "Jobs", icon: ListBullets },
  { href: "/dashboard/scheduled", label: "Scheduled", icon: CalendarBlank },
  {
    href: "/dashboard/dead-letter",
    label: "Dead letter queue",
    icon: SealWarning,
  },
  { href: "/dashboard/bin", label: "Bin", icon: TrashSimple },
  { href: "/dashboard/workers", label: "Workers", icon: Cpu },
  { href: "/dashboard/logs", label: "Event logs", icon: Scroll },
  { href: "/dashboard/settings", label: "Settings", icon: GearSix },
];

export function SidebarMenu() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <nav aria-label="Dashboard" className="block">
      <p className="px-3 font-mono text-[12px] uppercase tracking-[0.14em] text-accent-bright/70">
        Fleet
      </p>
      <ul className="mt-2 flex flex-col">
        {items.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${
                  active
                    ? "bg-white/[0.05] text-ink"
                    : "text-muted hover:bg-hover hover:text-ink"
                }`}
              >
                <item.icon
                  className={`size-[18px] transition-colors ${
                    active
                      ? "text-accent-bright"
                      : "text-faint group-hover:text-accent-bright"
                  }`}
                  weight={active ? "fill" : "regular"}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MobileMenuRow() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <nav
      aria-label="Dashboard"
      className="flex gap-1.5 overflow-x-auto border-y border-line px-5 py-2.5 sm:px-8 lg:hidden"
    >
      {items.map((item) => {
        const active = isActive(item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13.5px] transition-colors ${
              active
                ? "border-white/25 bg-white/[0.08] text-ink"
                : "border-line bg-white/[0.03] text-muted hover:text-ink"
            }`}
          >
            <item.icon
              className="size-[15px]"
              weight={active ? "fill" : "regular"}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
