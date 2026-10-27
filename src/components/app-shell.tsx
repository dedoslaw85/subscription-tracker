import { Link, useRouterState } from "@tanstack/react-router";
import { House, List, ScanLine, Settings, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { BannerAd } from "@/components/banner-ad";
import { useBills } from "@/lib/bills/store";

function Tab({
  to,
  label,
  icon: Icon,
}: {
  to: "/" | "/list" | "/scan" | "/settings";
  label: string;
  icon: LucideIcon;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const active = pathname === to;
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-sm ${
        active ? "text-accent" : "text-muted"
      }`}
    >
      <Icon size={22} strokeWidth={1.75} aria-hidden />
      {label}
    </Link>
  );
}

export function AppShell({ children, action }: { children: ReactNode; action?: ReactNode }) {
  const adsRemoved = useBills((state) => state.adsRemoved);

  return (
    <div className="mx-auto flex h-dvh w-full max-w-xl flex-col bg-bg text-fg">
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      {action ? <div className="shrink-0 px-5 pt-3 pb-3">{action}</div> : null}
      <nav
        className={`shrink-0 border-t border-line bg-surface ${adsRemoved ? "safe-bottom" : ""}`}
        aria-label="Primary"
      >
        <div className="flex">
          <Tab to="/" label="Home" icon={House} />
          <Tab to="/list" label="List" icon={List} />
          <Tab to="/scan" label="AI" icon={ScanLine} />
          <Tab to="/settings" label="Settings" icon={Settings} />
        </div>
      </nav>
      {adsRemoved ? null : <BannerAd />}
    </div>
  );
}
