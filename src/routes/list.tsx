import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { BillCard } from "@/components/bill-card";
import {
  filterBills,
  frequencyLabel,
  FREQUENCIES,
  type BillFilter,
} from "@/lib/bills/model";
import { useBills } from "@/lib/bills/store";

export const Route = createFileRoute("/list")({ component: BillList });

const FILTERS: BillFilter[] = ["all", ...FREQUENCIES];

function filterLabel(filter: BillFilter) {
  return filter === "all" ? "All" : frequencyLabel(filter);
}

function BillList() {
  const bills = useBills((state) => state.bills);
  const [filter, setFilter] = useState<BillFilter>("all");
  const visible = filterBills(bills, filter);
  const countLabel = visible.length === 1 ? "1 bill" : `${visible.length} bills`;

  return (
    <AppShell>
      <div className="px-5 pt-8 pb-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl text-fg">All bills</h1>
            <p className="mt-1 text-sm text-muted">{countLabel}</p>
          </div>
          <Link
            to="/bill/$id"
            params={{ id: "new" }}
            className="inline-flex h-11 items-center gap-1 rounded-control bg-accent px-4 text-on-accent"
          >
            <Plus size={18} strokeWidth={1.75} aria-hidden />
            Add
          </Link>
        </div>
        <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter">
          {FILTERS.map((item) => {
            const selected = item === filter;
            return (
              <button
                key={item}
                type="button"
                aria-pressed={selected}
                onClick={() => setFilter(item)}
                className={`h-11 rounded-control px-4 text-sm ${
                  selected
                    ? "bg-accent text-on-accent"
                    : "border border-line bg-surface text-fg"
                }`}
              >
                {filterLabel(item)}
              </button>
            );
          })}
        </div>
        {visible.length === 0 ? (
          <div className="mt-6 rounded-card border border-line bg-surface px-5 py-8 text-center">
            <p className="text-lg text-fg">Nothing in this group</p>
            <p className="mt-2 text-sm text-pretty text-muted">
              Try another filter, or add a bill.
            </p>
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {visible.map((bill) => (
              <li key={bill.id}>
                <BillCard bill={bill} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
