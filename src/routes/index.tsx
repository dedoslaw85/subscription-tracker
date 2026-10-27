import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BillCard } from "@/components/bill-card";
import { buttonClasses } from "@/components/ui/button";
import { billsDueSoon, duePhrase, formatGBP, monthlyTotal, sortBills } from "@/lib/bills/model";
import { useBills } from "@/lib/bills/store";
import { analyseMonth, formatMoney } from "@/lib/receipts/model";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const bills = useBills((state) => state.bills);
  const receipts = useBills((state) => state.receipts);
  const showSampleHint = useBills((state) => state.showSampleHint);
  const monthly = Math.round(monthlyTotal(bills) * 100) / 100;
  const upcoming = sortBills(bills).slice(0, 5);
  const soon = billsDueSoon(bills);
  const countLabel = bills.length === 1 ? "1 bill" : `${bills.length} bills`;
  const soonText =
    soon.length > 1
      ? `${soon.length} bills are due today or tomorrow.`
      : soon[0]
        ? `${soon[0].name} is due ${duePhrase(soon[0].nextDue).replace(/^([A-Z])/, (letter) => letter.toLowerCase())}.`
        : null;
  const spend = analyseMonth(receipts);

  return (
    <AppShell
      action={
        <Link to="/bill/$id" params={{ id: "new" }} className={buttonClasses({ variant: "primary" })}>
          <Plus size={20} strokeWidth={1.75} aria-hidden />
          Add new
        </Link>
      }
    >
      <div className="px-5 pt-8 pb-6">
        <p className="text-sm text-muted">Subscription Tracker</p>
        <h1 className="mt-6 text-sm text-muted">This month</h1>
        <p className="mt-1 text-4xl tracking-tight text-fg tabular-nums md:text-5xl">
          {formatGBP(monthly)}
        </p>
        <p className="mt-2 text-sm text-muted">
          About {formatGBP(monthly * 12)} a year · {countLabel}
        </p>
        {showSampleHint ? (
          <p className="mt-4 text-sm text-pretty text-muted">
            Examples are filled in. Change or delete them anytime.
          </p>
        ) : null}
        {soonText ? (
          <p className="mt-4 rounded-card bg-accent-soft px-4 py-3 text-sm text-pretty text-accent-ink">
            {soonText}
          </p>
        ) : null}
        {spend.count > 0 ? (
          <Link
            to="/scan"
            className="mt-4 flex items-baseline justify-between gap-3 rounded-card border border-line bg-surface px-4 py-4 shadow-card"
          >
            <span>
              <span className="block text-sm text-muted">Receipts this month</span>
              <span className="mt-1 block text-base text-fg">
                {spend.count === 1 ? "1 saved" : `${spend.count} saved`}
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-fg">{formatMoney(spend.total, "GBP")}</span>
          </Link>
        ) : null}
        <h2 className="mt-10 text-lg text-fg">Next payments</h2>
        {bills.length > 5 ? (
          <p className="mt-1 text-sm text-muted">The soonest five. The rest are on List.</p>
        ) : null}
        {upcoming.length === 0 ? (
          <div className="mt-3 rounded-card border border-line bg-surface px-5 py-8 text-center">
            <p className="text-lg text-fg">Nothing coming up</p>
            <p className="mt-2 text-sm text-pretty text-muted">
              Add a bill and it will show here with its due date.
            </p>
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {upcoming.map((bill) => (
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
