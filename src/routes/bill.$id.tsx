import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CATEGORIES,
  createId,
  formatGBP,
  FREQUENCIES,
  frequencyLabel,
  monthlyCost,
  parseAmount,
  type Frequency,
} from "@/lib/bills/model";
import { useBills } from "@/lib/bills/store";
import { formatMoney, receiptDateLabel, sortReceipts } from "@/lib/receipts/model";

export const Route = createFileRoute("/bill/$id")({ component: BillScreen });

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function BillScreen() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const existing = useBills((state) => state.bills.find((bill) => bill.id === id));
  const addBill = useBills((state) => state.addBill);
  const updateBill = useBills((state) => state.updateBill);
  const removeBill = useBills((state) => state.removeBill);
  const receipts = useBills((state) => state.receipts);
  const navigate = useNavigate();
  const router = useRouter();

  const [name, setName] = useState(existing?.name ?? "");
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? "monthly");
  const [nextDue, setNextDue] = useState(existing?.nextDue ?? todayIso());
  const [category, setCategory] = useState(existing?.category ?? "");
  const [error, setError] = useState("");
  const [askDelete, setAskDelete] = useState(false);

  function leave() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
      return;
    }
    void navigate({ to: "/" });
  }

  function save() {
    const trimmed = name.trim();
    const parsed = parseAmount(amount);
    if (!trimmed) {
      setError("Add a name.");
      return;
    }
    if (parsed == null) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!nextDue) {
      setError("Choose the next due date.");
      return;
    }
    const bill = {
      id: existing?.id ?? createId(),
      name: trimmed.slice(0, 60),
      amount: parsed,
      frequency,
      nextDue,
      category,
    };
    if (existing) updateBill(existing.id, bill);
    else addBill(bill);
    leave();
  }

  if (!isNew && !existing) {
    return (
      <main className="mx-auto flex h-dvh w-full max-w-xl flex-col justify-center bg-bg px-5 text-fg">
        <h1 className="text-2xl">This bill is gone</h1>
        <p className="mt-2 text-sm text-muted">It may have been deleted on this device.</p>
        <Button className="mt-6" onClick={() => void navigate({ to: "/list" })}>
          Back to the list
        </Button>
      </main>
    );
  }

  const parsed = parseAmount(amount);
  const monthHint =
    parsed != null && frequency !== "monthly"
      ? `About ${formatGBP(monthlyCost(parsed, frequency))} a month`
      : "Counted in the monthly total on Home.";
  const linked = existing
    ? sortReceipts(receipts.filter((receipt) => receipt.billId === existing.id))
    : [];

  return (
    <main className="mx-auto flex h-dvh w-full max-w-xl flex-col bg-bg text-fg">
      <header className="shrink-0 px-5 pt-8 pb-2">
        <h1 className="text-2xl">{isNew ? "Add a bill" : "Edit bill"}</h1>
        <p className="mt-1 text-sm text-muted">Name, amount, how often, and the next date.</p>
      </header>
      <form
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-x-hidden overflow-y-auto px-5 pt-4 pb-8"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <label className="flex flex-col gap-2" htmlFor="bill-name">
          <span className="text-sm">Name</span>
          <input
            id="bill-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            autoComplete="off"
            placeholder="Electricity"
            className="h-14 w-full min-w-0 max-w-full rounded-control border border-line bg-surface px-4 text-base outline-none"
          />
        </label>

        <label className="flex flex-col gap-2" htmlFor="bill-amount">
          <span className="text-sm">Amount</span>
          <span className="flex h-14 min-w-0 items-center rounded-control border border-line bg-surface px-4">
            <span className="text-muted" aria-hidden>
              £
            </span>
            <input
              id="bill-amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              className="w-full bg-transparent pl-2 text-base tabular-nums outline-none"
            />
          </span>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm">Frequency</legend>
          <div className="grid grid-cols-3 gap-2">
            {FREQUENCIES.map((item) => {
              const selected = item === frequency;
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFrequency(item)}
                  className={`h-14 rounded-control text-base ${
                    selected ? "bg-accent text-on-accent" : "border border-line bg-surface text-fg"
                  }`}
                >
                  {frequencyLabel(item)}
                </button>
              );
            })}
          </div>
          <p className="text-sm text-muted">{monthHint}</p>
        </fieldset>

        <label className="flex flex-col gap-2" htmlFor="bill-due">
          <span className="text-sm">Next due date</span>
          <input
            id="bill-due"
            type="date"
            value={nextDue}
            onChange={(event) => setNextDue(event.target.value)}
            className="h-14 w-full min-w-0 max-w-full rounded-control border border-line bg-surface px-4 text-base outline-none"
          />
        </label>

        <label className="flex flex-col gap-2" htmlFor="bill-category">
          <span className="text-sm">
            Category <span className="text-muted">optional</span>
          </span>
          <select
            id="bill-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-14 w-full min-w-0 max-w-full rounded-control border border-line bg-surface px-4 text-base outline-none"
          >
            <option value="">None</option>
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        {linked.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm">Receipts</h2>
            <ul className="flex flex-col gap-2">
              {linked.map((receipt) => (
                <li
                  key={receipt.id}
                  className="flex items-center gap-3 rounded-control border border-line bg-surface px-3 py-3"
                >
                  {receipt.image ? (
                    <img
                      src={receipt.image}
                      alt=""
                      className="h-14 w-11 shrink-0 rounded-control object-cover outline outline-1 -outline-offset-1 outline-line"
                    />
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base text-fg">{receipt.merchant}</span>
                    <span className="block truncate text-sm text-muted">
                      {[receiptDateLabel(receipt.date), receipt.category].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-fg">
                    {formatMoney(receipt.total, receipt.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? <p className="text-sm text-accent-ink">{error}</p> : null}

        <div className="mt-auto flex flex-col gap-3 pt-2">
          {askDelete ? (
            <>
              <p className="text-sm text-muted">Delete {existing?.name}? This can’t be undone.</p>
              <Button
                onClick={() => {
                  if (existing) removeBill(existing.id);
                  leave();
                }}
              >
                Delete
              </Button>
              <Button variant="quiet" onClick={() => setAskDelete(false)}>
                Keep
              </Button>
            </>
          ) : (
            <>
              <Button type="submit">Save</Button>
              <Button variant="quiet" onClick={leave}>
                Cancel
              </Button>
              {existing ? (
                <Button variant="subtle" onClick={() => setAskDelete(true)}>
                  Delete this bill
                </Button>
              ) : null}
            </>
          )}
        </div>
      </form>
    </main>
  );
}
