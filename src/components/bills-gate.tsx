import { useEffect, type ReactNode } from "react";
import { notifyDueBills, prepareBills, useBills } from "@/lib/bills/store";

export function BillsGate({ children }: { children: ReactNode }) {
  const hydrated = useBills((state) => state.hydrated);

  useEffect(() => {
    let alive = true;
    const finish = () => {
      if (!alive) return;
      prepareBills();
      notifyDueBills();
      if (!useBills.getState().hydrated) useBills.getState().setHydrated(true);
    };
    try {
      const pending = useBills.persist.rehydrate() as void | Promise<void>;
      if (pending && typeof pending.then === "function") void pending.then(finish, finish);
      else finish();
    } catch {
      finish();
    }
    return () => {
      alive = false;
    };
  }, []);

  if (!hydrated) {
    return (
      <div className="mx-auto flex h-dvh w-full max-w-xl flex-col bg-bg px-5 pt-8 text-fg">
        <p className="text-sm text-muted">Subscription Tracker</p>
        <p className="mt-6 text-base text-muted">Loading your bills</p>
      </div>
    );
  }

  return children;
}