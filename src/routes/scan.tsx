import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, ImagePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { createId, formatGBP, sortBills, type Bill } from "@/lib/bills/model";
import { useBills } from "@/lib/bills/store";
import { compressReceiptImage } from "@/lib/receipts/image";
import {
  SPEND_CATEGORIES,
  analyseMonth,
  billCategoryFor,
  formatMoney,
  isGbp,
  receiptDateLabel,
  receiptFromScan,
  sortReceipts,
  suggestBill,
  type Receipt,
} from "@/lib/receipts/model";
import { readReceipt } from "@/lib/receipts/scan";

export const Route = createFileRoute("/scan")({ component: ScanScreen });

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function ScanScreen() {
  const bills = useBills((state) => state.bills);
  const receipts = useBills((state) => state.receipts);
  const addBill = useBills((state) => state.addBill);
  const addReceipt = useBills((state) => state.addReceipt);
  const updateReceipt = useBills((state) => state.updateReceipt);
  const removeReceipt = useBills((state) => state.removeReceipt);
  const navigate = useNavigate();

  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualCategory, setManualCategory] = useState<string>("Groceries");
  const [manualDate, setManualDate] = useState(todayIso());

  const focus = receipts.find((receipt) => receipt.id === focusId) ?? null;
  const spend = analyseMonth(receipts);
  const recent = sortReceipts(receipts);

  useEffect(() => {
    if (!notice) return;
    noticeRef.current?.scrollIntoView({ block: "start" });
  }, [notice]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setNotice("");
    setFailed(false);
    setFocusId(null);
    try {
      const image = await compressReceiptImage(file);
      setDraft(image);
    } catch (error) {
      setDraft(null);
      setNotice(error instanceof Error ? error.message : "That photo couldn’t be opened.");
    }
  }

  async function read() {
    if (!draft || reading) return;
    setReading(true);
    setNotice("");
    setFailed(false);
    try {
      const result = await readReceipt({ data: { image: draft } });
      if (!result.ok) {
        setFailed(true);
        setNotice(result.error);
        return;
      }
      if (!result.receipt.readable) {
        setFailed(true);
        setNotice(result.receipt.summary);
        if (result.receipt.merchant) setManualName(result.receipt.merchant);
        return;
      }
      const receipt = receiptFromScan(result.receipt, draft);
      addReceipt(receipt);
      setFocusId(receipt.id);
      setDraft(null);
      setNotice("");
    } catch {
      setFailed(true);
      setNotice("That photo couldn’t be read. Try again in a moment.");
    } finally {
      setReading(false);
    }
  }

  function saveManual() {
    const trimmed = manualName.trim();
    const parsed = Number(manualAmount.replace(/[£,\s]/g, ""));
    if (!trimmed) {
      setNotice("Add the shop or bill name.");
      return;
    }
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1_000_000) {
      setNotice("Enter an amount greater than zero.");
      return;
    }
    const receipt: Receipt = {
      id: createId(),
      createdAt: new Date().toISOString(),
      merchant: trimmed.slice(0, 80),
      date: manualDate,
      total: Math.round(parsed * 100) / 100,
      currency: "GBP",
      category: manualCategory || "Other",
      summary: `${trimmed} came to ${formatGBP(Math.round(parsed * 100) / 100)}.`,
      recurring: false,
      frequency: null,
      items: [],
      billId: null,
      image: draft ?? "",
      source: "manual",
    };
    addReceipt(receipt);
    setFocusId(receipt.id);
    setDraft(null);
    setFailed(false);
    setNotice("");
    setManualName("");
    setManualAmount("");
  }

  function trackAsBill(receipt: Receipt) {
    if (!isFiniteBill(receipt)) return;
    const frequency = receipt.frequency ?? "monthly";
    const bill = {
      id: createId(),
      name: receipt.merchant.slice(0, 60) || "Receipt",
      amount: receipt.total,
      frequency,
      nextDue: receipt.date || todayIso(),
      category: billCategoryFor(receipt.category),
    };
    addBill(bill);
    updateReceipt(receipt.id, { billId: bill.id, recurring: true, frequency });
    void navigate({ to: "/bill/$id", params: { id: bill.id } });
  }

  return (
    <AppShell
      action={
        draft && failed ? (
          <Button onClick={saveManual}>Save to spending</Button>
        ) : draft ? (
          <Button onClick={() => void read()} disabled={reading}>
            {reading ? "Reading…" : "Read receipt"}
          </Button>
        ) : undefined
      }
    >
      <div className="px-5 pt-8 pb-8">
        <h1 className="text-2xl text-fg">Read a receipt</h1>
        <p className="mt-1 text-sm text-pretty text-muted">
          Take a photo. It’s read, summarised, and saved with your spending.
        </p>

        {notice ? (
          <p
            ref={noticeRef}
            className="mt-4 rounded-card bg-accent-soft px-4 py-3 text-sm text-pretty text-accent-ink"
            role="status"
          >
            {notice}
          </p>
        ) : null}

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void onFile(file);
          }}
        />
        <input
          ref={libraryRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void onFile(file);
          }}
        />

        {draft && failed ? (
          <div className="mt-4 flex items-center gap-3">
            <img
              src={draft}
              alt=""
              className="h-16 w-12 shrink-0 rounded-control object-cover outline outline-1 -outline-offset-1 outline-line"
            />
            <p className="text-sm text-muted">The photo stays with this receipt.</p>
          </div>
        ) : draft ? (
          <div className="mt-6">
            <img
              src={draft}
              alt="Receipt to read"
              className="max-h-72 w-full rounded-card bg-surface object-contain outline outline-1 -outline-offset-1 outline-line"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="quiet" onClick={() => cameraRef.current?.click()} disabled={reading}>
                Retake
              </Button>
              <Button variant="quiet" onClick={() => libraryRef.current?.click()} disabled={reading}>
                Choose another
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-card border border-line bg-surface px-3 text-fg shadow-card"
            >
              <Camera size={22} strokeWidth={1.75} aria-hidden />
              Take photo
            </button>
            <button
              type="button"
              onClick={() => libraryRef.current?.click()}
              className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-card border border-line bg-surface px-3 text-fg shadow-card"
            >
              <ImagePlus size={22} strokeWidth={1.75} aria-hidden />
              Choose photo
            </button>
          </div>
        )}

        {failed && draft ? (
          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveManual();
            }}
          >
            <p className="text-sm text-muted">Type the receipt in, and it still joins this month’s spending.</p>
            <label className="flex flex-col gap-2" htmlFor="manual-name">
              <span className="text-sm">Name</span>
              <input
                id="manual-name"
                value={manualName}
                onChange={(event) => setManualName(event.target.value)}
                maxLength={80}
                placeholder="Corner shop"
                className="h-14 w-full rounded-control border border-line bg-surface px-4 text-base outline-none"
              />
            </label>
            <label className="flex flex-col gap-2" htmlFor="manual-amount">
              <span className="text-sm">Amount</span>
              <span className="flex h-14 items-center rounded-control border border-line bg-surface px-4">
                <span className="text-muted" aria-hidden>
                  £
                </span>
                <input
                  id="manual-amount"
                  value={manualAmount}
                  onChange={(event) => setManualAmount(event.target.value.replace(/[^\d.]/g, ""))}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="w-full bg-transparent pl-2 text-base tabular-nums outline-none"
                />
              </span>
            </label>
            <label className="flex flex-col gap-2" htmlFor="manual-category">
              <span className="text-sm">Category</span>
              <select
                id="manual-category"
                value={manualCategory}
                onChange={(event) => setManualCategory(event.target.value)}
                className="h-14 w-full rounded-control border border-line bg-surface px-4 text-base outline-none"
              >
                {SPEND_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2" htmlFor="manual-date">
              <span className="text-sm">Date</span>
              <input
                id="manual-date"
                type="date"
                value={manualDate}
                onChange={(event) => setManualDate(event.target.value)}
                className="h-14 w-full rounded-control border border-line bg-surface px-4 text-base outline-none"
              />
            </label>
            <Button variant="quiet" onClick={() => void read()} disabled={reading}>
              {reading ? "Reading…" : "Try reading again"}
            </Button>
          </form>
        ) : null}

        {focus ? (
          <ReceiptDetail
            key={focus.id}
            receipt={focus}
            bills={bills}
            onChange={(patch) => updateReceipt(focus.id, patch)}
            onDelete={() => {
              removeReceipt(focus.id);
              setFocusId(null);
            }}
            onTrack={() => trackAsBill(focus)}
          />
        ) : null}

        {receipts.length > 0 ? (
          <>
            <SpendPanel spend={spend} />
            <h2 className="mt-10 text-lg text-fg">Saved receipts</h2>
            <ul className="mt-3 flex flex-col gap-3">
              {recent.map((receipt) => {
                const open = receipt.id === focusId;
                return (
                  <li key={receipt.id}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => {
                        setDraft(null);
                        setFailed(false);
                        setNotice("");
                        setFocusId(open ? null : receipt.id);
                      }}
                      className={`w-full rounded-card border px-4 py-4 text-left shadow-card ${
                        open ? "border-accent bg-accent-soft" : "border-line bg-surface"
                      }`}
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-lg text-fg">{receipt.merchant}</span>
                        <span className="shrink-0 tabular-nums text-fg">
                          {formatMoney(receipt.total, receipt.currency)}
                        </span>
                      </span>
                      <span className="mt-1 flex items-baseline justify-between gap-3 text-sm text-muted">
                        <span className="min-w-0 truncate">{receipt.category}</span>
                        <span className="shrink-0">{receiptDateLabel(receipt.date)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

function isFiniteBill(receipt: Receipt) {
  return receipt.merchant.trim().length > 0 && receipt.total > 0;
}

function ReceiptDetail({
  receipt,
  bills,
  onChange,
  onDelete,
  onTrack,
}: {
  receipt: Receipt;
  bills: Bill[];
  onChange: (patch: Partial<Omit<Receipt, "id">>) => void;
  onDelete: () => void;
  onTrack: () => void;
}) {
  const [amount, setAmount] = useState(String(receipt.total));
  const [merchant, setMerchant] = useState(receipt.merchant);
  const [askDelete, setAskDelete] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const suggestion = suggestBill(receipt.merchant, bills);
  const linked = bills.find((bill) => bill.id === receipt.billId) ?? null;

  useEffect(() => {
    sectionRef.current?.scrollIntoView({ block: "start" });
  }, []);

  return (
    <section ref={sectionRef} className="mt-6 rounded-card border border-line bg-surface px-4 py-4 shadow-card">
      <p className="text-sm text-muted">
        {receipt.source === "scan" ? "Saved to spending" : "Saved by hand"} · {receipt.category}
      </p>
      <p className="mt-3 text-sm text-pretty text-fg">{receipt.summary}</p>
      {!isGbp(receipt.currency) ? (
        <p className="mt-2 text-sm text-muted">This one isn’t in pounds, so it stays out of the monthly total.</p>
      ) : null}
      {receipt.image ? (
        <img
          src={receipt.image}
          alt=""
          className="mt-4 max-h-72 w-full rounded-control bg-bg object-contain outline outline-1 -outline-offset-1 outline-line"
        />
      ) : null}

      {receipt.items.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
          {receipt.items.map((item, index) => (
            <li key={`${item.name}-${index}`} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 text-fg">
                {item.name}
                {item.quantity != null ? <span className="text-muted"> × {item.quantity}</span> : null}
              </span>
              {item.amount != null ? (
                <span className="shrink-0 tabular-nums text-muted">{formatMoney(item.amount, receipt.currency)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-col gap-4 border-t border-line pt-4">
        <label className="flex flex-col gap-2" htmlFor={`merchant-${receipt.id}`}>
          <span className="text-sm">Name</span>
          <input
            id={`merchant-${receipt.id}`}
            value={merchant}
            onChange={(event) => setMerchant(event.target.value)}
            onBlur={() => {
              const next = merchant.trim().slice(0, 80);
              if (next && next !== receipt.merchant) onChange({ merchant: next });
              else setMerchant(receipt.merchant);
            }}
            className="h-14 w-full rounded-control border border-line bg-bg px-4 text-base outline-none"
          />
        </label>
        <label className="flex flex-col gap-2" htmlFor={`amount-${receipt.id}`}>
          <span className="text-sm">Amount</span>
          <input
            id={`amount-${receipt.id}`}
            value={amount}
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))}
            onBlur={() => {
              const parsed = Number(amount);
              if (Number.isFinite(parsed) && parsed > 0 && parsed <= 1_000_000) {
                const total = Math.round(parsed * 100) / 100;
                if (total !== receipt.total) onChange({ total });
                setAmount(String(total));
              } else {
                setAmount(String(receipt.total));
              }
            }}
            className="h-14 w-full rounded-control border border-line bg-bg px-4 text-base tabular-nums outline-none"
          />
        </label>
        <label className="flex flex-col gap-2" htmlFor={`category-${receipt.id}`}>
          <span className="text-sm">Category</span>
          <select
            id={`category-${receipt.id}`}
            value={SPEND_CATEGORIES.includes(receipt.category as (typeof SPEND_CATEGORIES)[number]) ? receipt.category : "Other"}
            onChange={(event) => onChange({ category: event.target.value })}
            className="h-14 w-full rounded-control border border-line bg-bg px-4 text-base outline-none"
          >
            {SPEND_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2" htmlFor={`date-${receipt.id}`}>
          <span className="text-sm">Date</span>
          <input
            id={`date-${receipt.id}`}
            type="date"
            value={receipt.date}
            onChange={(event) => onChange({ date: event.target.value })}
            className="h-14 w-full rounded-control border border-line bg-bg px-4 text-base outline-none"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {linked ? (
          <p className="text-sm text-muted">Attached to {linked.name}. The monthly bill total stays as it is.</p>
        ) : suggestion ? (
          <Button onClick={() => onChange({ billId: suggestion.id })}>Attach to {suggestion.name}</Button>
        ) : null}
        <label className="flex flex-col gap-2" htmlFor={`bill-${receipt.id}`}>
          <span className="text-sm">Bill</span>
          <select
            id={`bill-${receipt.id}`}
            value={receipt.billId ?? ""}
            onChange={(event) => onChange({ billId: event.target.value || null })}
            className="h-14 w-full rounded-control border border-line bg-bg px-4 text-base outline-none"
          >
            <option value="">Not attached</option>
            {sortBills(bills).map((bill) => (
              <option key={bill.id} value={bill.id}>
                {bill.name}
              </option>
            ))}
          </select>
        </label>
        {!linked ? (
          <Button variant={suggestion ? "quiet" : "primary"} onClick={onTrack}>
            Track as a recurring bill
          </Button>
        ) : null}
        {askDelete ? (
          <>
            <p className="text-sm text-muted">Delete this receipt? The photo goes with it.</p>
            <Button onClick={onDelete}>Delete</Button>
            <Button variant="quiet" onClick={() => setAskDelete(false)}>
              Keep
            </Button>
          </>
        ) : (
          <Button variant="subtle" onClick={() => setAskDelete(true)}>
            Delete this receipt
          </Button>
        )}
      </div>
    </section>
  );
}

function SpendPanel({ spend }: { spend: ReturnType<typeof analyseMonth> }) {
  const peak = spend.categories[0]?.total ?? 0;
  return (
    <section className="mt-10">
      <h2 className="text-lg text-fg">{spend.label}</h2>
      <p className="mt-1 text-3xl tracking-tight text-fg tabular-nums">{formatGBP(spend.total)}</p>
      <p className="mt-2 text-sm text-pretty text-muted">
        {spend.count === 1 ? "1 receipt" : `${spend.count} receipts`}
        {spend.linked > 0 ? ` · ${formatGBP(spend.linked)} already on a bill` : ""}
        {spend.extra > 0 && spend.linked > 0 ? ` · ${formatGBP(spend.extra)} not linked` : ""}
        {spend.otherCurrencies > 0
          ? ` · ${spend.otherCurrencies === 1 ? "1 receipt in another currency isn’t" : `${spend.otherCurrencies} receipts in other currencies aren’t`} in this total`
          : ""}
      </p>
      {spend.categories.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-3">
          {spend.categories.map((slice) => {
            const width = peak > 0 ? Math.max(8, Math.round((slice.total / peak) * 100)) : 0;
            return (
              <li key={slice.category}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-fg">{slice.category}</span>
                  <span className="tabular-nums text-muted">{formatGBP(slice.total)}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-accent-soft" aria-hidden>
                  <div className="h-2 rounded-full bg-accent" style={{ width: `${width}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">No pound totals in this month yet.</p>
      )}
    </section>
  );
}
