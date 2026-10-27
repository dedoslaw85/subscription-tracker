import { Leaf } from "lucide-react";

export function BannerAd() {
  return (
    <aside
      className="safe-bottom shrink-0 border-t border-line bg-surface px-4 pt-3"
      aria-label="Advertisement"
    >
      <div className="flex items-center gap-3 pb-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-control bg-accent-soft text-accent">
          <Leaf size={20} strokeWidth={1.75} aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs tracking-wide text-muted uppercase">Ad</p>
          <p className="truncate text-base text-fg">Fieldnote tea</p>
          <p className="truncate text-sm text-muted">A quiet cup, delivered once a month.</p>
        </div>
      </div>
    </aside>
  );
}
