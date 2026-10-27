import { format, parseISO } from "date-fns";
import { enGB } from "date-fns/locale";
import { createId, formatGBP, type Bill, type Frequency } from "@/lib/bills/model";

export const SPEND_CATEGORIES = [
  "Groceries",
  "Dining",
  "Transport",
  "Shopping",
  "Fuel",
  "Utilities",
  "Health",
  "Home",
  "Entertainment",
  "Subscriptions",
  "Other",
] as const;

export type SpendCategory = (typeof SPEND_CATEGORIES)[number];

export type ReceiptItem = {
  name: string;
  quantity: number | null;
  amount: number | null;
};

export type Receipt = {
  id: string;
  createdAt: string;
  merchant: string;
  date: string;
  total: number;
  currency: string;
  category: string;
  summary: string;
  recurring: boolean;
  frequency: Frequency | null;
  items: ReceiptItem[];
  billId: string | null;
  image: string;
  source: "scan" | "manual";
};

export type ScannedReceipt = {
  readable: boolean;
  merchant: string;
  date: string;
  total: number;
  currency: string;
  category: string;
  summary: string;
  recurring: boolean;
  frequency: Frequency | null;
  items: ReceiptItem[];
};

const BILL_CATEGORY: Record<string, string> = {
  Utilities: "Utilities",
  Health: "Health",
  Home: "Home",
  Entertainment: "Streaming",
  Subscriptions: "Software",
};

export function isGbp(currency: string) {
  const code = currency.trim().toUpperCase();
  return code === "" || code === "GBP" || code === "£";
}

export function formatMoney(amount: number, currency: string) {
  if (isGbp(currency)) return formatGBP(amount);
  const code = currency.trim().toUpperCase();
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: code }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

export function billCategoryFor(category: string) {
  return BILL_CATEGORY[category] ?? "Other";
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function asMoney(value: unknown) {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/[£$€,\s]/g, ""))
        : NaN;
  if (!Number.isFinite(raw) || raw <= 0 || raw > 1_000_000) return 0;
  return roundMoney(raw);
}

function asDate(value: unknown) {
  if (typeof value !== "string") return "";
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = parseISO(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return iso;
}

function asCategory(value: unknown) {
  if (typeof value !== "string") return "Other";
  const found = SPEND_CATEGORIES.find((item) => item.toLowerCase() === value.trim().toLowerCase());
  return found ?? "Other";
}

function asCurrency(value: unknown) {
  if (typeof value !== "string") return "GBP";
  const code = value.trim().toUpperCase();
  if (code === "" || code === "£" || code === "GBP") return "GBP";
  return /^[A-Z]{3}$/.test(code) ? code : "GBP";
}

function asFrequency(value: unknown): Frequency | null {
  if (value === "weekly" || value === "monthly" || value === "yearly") return value;
  return null;
}

function asItems(value: unknown): ReceiptItem[] {
  if (!Array.isArray(value)) return [];
  const items: ReceiptItem[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as { name?: unknown; quantity?: unknown; amount?: unknown };
    const name = typeof record.name === "string" ? record.name.trim().slice(0, 80) : "";
    if (!name) continue;
    const quantity =
      typeof record.quantity === "number" && Number.isFinite(record.quantity) && record.quantity > 0
        ? roundMoney(record.quantity)
        : null;
    const amount =
      typeof record.amount === "number" &&
      Number.isFinite(record.amount) &&
      record.amount >= 0 &&
      record.amount <= 1_000_000
        ? roundMoney(record.amount)
        : null;
    items.push({ name, quantity, amount });
    if (items.length >= 25) break;
  }
  return items;
}

export function parseScannedReceipt(value: unknown): ScannedReceipt | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const merchant = typeof record.merchant === "string" ? record.merchant.trim().slice(0, 80) : "";
  const total = asMoney(record.total);
  const items = asItems(record.items);
  let summary = typeof record.summary === "string" ? record.summary.trim().slice(0, 400) : "";
  const frequency = asFrequency(record.frequency);
  const readable = record.readable === true && total > 0;
  if (!summary) {
    summary = readable
      ? `${merchant || "This receipt"} came to ${formatMoney(total, asCurrency(record.currency))}.`
      : "This photo couldn’t be read as a receipt.";
  }
  return {
    readable,
    merchant,
    date: asDate(record.date),
    total,
    currency: asCurrency(record.currency),
    category: asCategory(record.category),
    summary,
    recurring: record.recurring === true || frequency != null,
    frequency,
    items,
  };
}

export function parseModelJson(text: string): ScannedReceipt | null {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      value = JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return parseScannedReceipt(value);
}

function cleanImage(value: unknown) {
  if (typeof value !== "string") return "";
  if (value.length > 1_800_000) return "";
  if (value.startsWith("data:image/jpeg;base64,") || value.startsWith("data:image/png;base64,")) {
    return value;
  }
  return "";
}

export function sanitizeReceipt(value: unknown): Receipt | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<Receipt>;
  if (typeof record.id !== "string" || typeof record.merchant !== "string") return null;
  if (typeof record.total !== "number" || !Number.isFinite(record.total) || record.total <= 0) return null;
  if (typeof record.createdAt !== "string") return null;
  const frequency = asFrequency(record.frequency);
  return {
    id: record.id,
    createdAt: record.createdAt,
    merchant: record.merchant.slice(0, 80),
    date: asDate(record.date),
    total: roundMoney(record.total),
    currency: asCurrency(record.currency),
    category: asCategory(record.category),
    summary: typeof record.summary === "string" ? record.summary.slice(0, 400) : "",
    recurring: record.recurring === true || frequency != null,
    frequency,
    items: asItems(record.items),
    billId: typeof record.billId === "string" ? record.billId : null,
    image: cleanImage(record.image),
    source: record.source === "manual" ? "manual" : "scan",
  };
}

export function trimReceipts(receipts: Receipt[]) {
  const sorted = [...receipts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30);
  return sorted.map((receipt, index) => (index < 8 ? receipt : { ...receipt, image: "" }));
}

export function receiptFromScan(scan: ScannedReceipt, image: string): Receipt {
  return {
    id: createId(),
    createdAt: new Date().toISOString(),
    merchant: scan.merchant || "Receipt",
    date: scan.date,
    total: scan.total,
    currency: scan.currency,
    category: scan.category,
    summary: scan.summary,
    recurring: scan.recurring,
    frequency: scan.frequency,
    items: scan.items,
    billId: null,
    image,
    source: "scan",
  };
}

export function receiptMonth(receipt: Receipt) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(receipt.date)) return receipt.date.slice(0, 7);
  return receipt.createdAt.slice(0, 7);
}

export function receiptDateLabel(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "No date";
  const parsed = parseISO(iso);
  if (Number.isNaN(parsed.getTime())) return "No date";
  return format(parsed, "d MMM yyyy", { locale: enGB });
}

export function monthLabel(month = format(new Date(), "yyyy-MM")) {
  const parsed = parseISO(`${month}-01`);
  if (Number.isNaN(parsed.getTime())) return month;
  return format(parsed, "MMMM yyyy", { locale: enGB });
}

export type SpendSlice = { category: string; total: number };

export function analyseMonth(receipts: Receipt[], month = format(new Date(), "yyyy-MM")) {
  const inMonth = receipts.filter((receipt) => receiptMonth(receipt) === month);
  const counted = inMonth.filter((receipt) => isGbp(receipt.currency));
  const total = roundMoney(counted.reduce((sum, receipt) => sum + receipt.total, 0));
  const linked = roundMoney(
    counted.filter((receipt) => receipt.billId).reduce((sum, receipt) => sum + receipt.total, 0),
  );
  const byCategory = new Map<string, number>();
  for (const receipt of counted) {
    byCategory.set(receipt.category, (byCategory.get(receipt.category) ?? 0) + receipt.total);
  }
  const categories: SpendSlice[] = [...byCategory.entries()]
    .map(([category, amount]) => ({ category, total: roundMoney(amount) }))
    .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
  return {
    month,
    label: monthLabel(month),
    count: inMonth.length,
    otherCurrencies: inMonth.length - counted.length,
    total,
    linked,
    extra: roundMoney(total - linked),
    categories,
  };
}

function normaliseName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function suggestBill(merchant: string, bills: Bill[]): Bill | null {
  const source = normaliseName(merchant);
  if (source.length < 3) return null;
  let best: { bill: Bill; score: number } | null = null;
  for (const bill of bills) {
    const name = normaliseName(bill.name);
    if (name.length < 3) continue;
    let score = 0;
    if (source === name) score = 3;
    else if (source.includes(name) || name.includes(source)) score = 2;
    if (!best || score > best.score) best = { bill, score };
  }
  return best && best.score >= 2 ? best.bill : null;
}

export function sortReceipts(receipts: Receipt[]) {
  return [...receipts].sort((a, b) => {
    const left = a.date || a.createdAt;
    const right = b.date || b.createdAt;
    return right.localeCompare(left) || b.createdAt.localeCompare(a.createdAt);
  });
}
