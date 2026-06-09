"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquareText,
  ListChecks,
  Users,
  TrendingUp,
  Quote,
  Search,
  FolderTree,
  CheckSquare,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV: { group: string; items: { href: string; label: string; icon: React.ElementType }[] }[] = [
  {
    group: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/responses", label: "Response Explorer", icon: MessageSquareText },
    ],
  },
  {
    group: "Configuration",
    items: [
      { href: "/prompts", label: "Prompt Manager", icon: ListChecks },
      { href: "/competitors", label: "Competitors", icon: Users },
      { href: "/brands", label: "Brands", icon: FolderTree },
    ],
  },
  {
    group: "Intelligence",
    items: [
      { href: "/benchmarking", label: "Share of Voice", icon: TrendingUp },
      { href: "/citations", label: "Citation Analysis", icon: Quote },
      { href: "/fan-out", label: "Fan-Out Queries", icon: Search },
      { href: "/categories", label: "Category Performance", icon: FolderTree },
      { href: "/action-items", label: "Action Items", icon: CheckSquare },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex h-14 items-center gap-2 border-b px-5">
        <Sparkles className="h-5 w-5 text-primary" />
        <span className="font-semibold tracking-tight">AI Visibility</span>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {NAV.map((section) => (
          <div key={section.group}>
            <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {section.group}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
