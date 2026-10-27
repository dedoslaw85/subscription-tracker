import { Link } from "@tanstack/react-router";
import { duePhrase, formatGBP, frequencyLabel, isSoon, type Bill } from "@/lib/bills/model";
import { useBills } from "@/lib/bills/store";

export function BillCard({ bill }: { bill: Bill }) {
  const hasReceipt = useBills((state) => state.receipts.some((receipt) => receipt.billId === bill.id));
  const meta = [bill.category, frequencyLabel(bill.frequency), hasReceipt ? "Receipt" : ""]
    .filter(Boolean)
    .join(" · ");
  const soon = isSoon(bill.nextDue);

  return (
    <Link
      to="/bill/$id"
      params={{ id: bill.id }}
      className="block rounded-card border border-line bg-surface px-4 py-4 shadow-card"
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-lg text-fg">{bill.name}</span>
        <span className="shrink-0 tabular-nums text-fg">{formatGBP(bill.amount)}</span>
      </span>
      <span className="mt-1 flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-muted">{meta}</span>
        <span className={`shrink-0 ${soon ? "text-accent" : "text-muted"}`}>{duePhrase(bill.nextDue)}</span>
      </span>
    </Link>
  );
}
