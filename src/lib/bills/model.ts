import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  format,
  isBefore,
  parseISO,
  startOfDay,
} from "date-fns";
import { enGB } from "date-fns/locale";

export const FREQUENCIES = ["weekly", "monthly", "yearly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const CATEGORIES = [
  "Streaming",
  "Music",
  "Utilities",
  "Insurance",
  "Health",
  "Software",
  "Home",
  "Other",
] as const;

export type Bill = {
  id: string;
  name: string;
  amount: number;
  frequency: Frequency;
  nextDue: string;
  category: string;
};

export type BillFilter = "all" | Frequency;

export function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `bill-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function frequencyLabel(frequency: Frequency) {
  if (frequency === "weekly") return "Weekly";
  if (frequency === "yearly") return "Yearly";
  return "Monthly";
}

export function formatGBP(amount: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

export function monthlyCost(amount: number, frequency: Frequency) {
  if (frequency === "weekly") return (amount * 52) / 12;
  if (frequency === "yearly") return amount / 12;
  return amount;
}

export function monthlyTotal(bills: Bill[]) {
  return bills.reduce((sum, bill) => sum + monthlyCost(bill.amount, bill.frequency), 0);
}

function step(date: Date, frequency: Frequency) {
  if (frequency === "weekly") return addWeeks(date, 1);
  if (frequency === "yearly") return addYears(date, 1);
  return addMonths(date, 1);
}

export function normalizeBill(bill: Bill, today = startOfDay(new Date())): Bill {
  const parsed = parseISO(bill.nextDue);
  if (Number.isNaN(parsed.getTime())) {
    return { ...bill, nextDue: format(today, "yyyy-MM-dd") };
  }
  let cursor = startOfDay(parsed);
  let guard = 0;
  while (isBefore(cursor, today) && guard < 600) {
    cursor = step(cursor, bill.frequency);
    guard += 1;
  }
  const nextDue = format(cursor, "yyyy-MM-dd");
  return nextDue === bill.nextDue ? bill : { ...bill, nextDue };
}

export function duePhrase(iso: string, today = startOfDay(new Date())) {
  const date = startOfDay(parseISO(iso));
  if (Number.isNaN(date.getTime())) return "No date";
  const formatted = format(date, "d MMM", { locale: enGB });
  const days = differenceInCalendarDays(date, today);
  if (days === 0) return `Today, ${formatted}`;
  if (days === 1) return `Tomorrow, ${formatted}`;
  return formatted;
}

export function isSoon(iso: string, today = startOfDay(new Date())) {
  const date = startOfDay(parseISO(iso));
  if (Number.isNaN(date.getTime())) return false;
  const days = differenceInCalendarDays(date, today);
  return days === 0 || days === 1;
}

export function sortBills(bills: Bill[]) {
  return [...bills].sort(
    (a, b) => a.nextDue.localeCompare(b.nextDue) || a.name.localeCompare(b.name),
  );
}

export function filterBills(bills: Bill[], filter: BillFilter) {
  const list = filter === "all" ? bills : bills.filter((bill) => bill.frequency === filter);
  return sortBills(list);
}

export function sampleBills(today = startOfDay(new Date())): Bill[] {
  const due = (days: number) => format(addDays(today, days), "yyyy-MM-dd");
  return [
    {
      id: createId(),
      name: "Electricity",
      amount: 68,
      frequency: "monthly",
      nextDue: due(1),
      category: "Utilities",
    },
    {
      id: createId(),
      name: "Netflix",
      amount: 10.99,
      frequency: "monthly",
      nextDue: due(3),
      category: "Streaming",
    },
    {
      id: createId(),
      name: "Coffee club",
      amount: 4.5,
      frequency: "weekly",
      nextDue: due(4),
      category: "Other",
    },
    {
      id: createId(),
      name: "Spotify",
      amount: 11.99,
      frequency: "monthly",
      nextDue: due(8),
      category: "Music",
    },
    {
      id: createId(),
      name: "Gym",
      amount: 32,
      frequency: "monthly",
      nextDue: due(12),
      category: "Health",
    },
    {
      id: createId(),
      name: "Cloud storage",
      amount: 2.99,
      frequency: "monthly",
      nextDue: due(20),
      category: "Software",
    },
    {
      id: createId(),
      name: "Home insurance",
      amount: 186,
      frequency: "yearly",
      nextDue: due(40),
      category: "Insurance",
    },
  ];
}

export function parseAmount(raw: string) {
  const cleaned = raw.trim().replace(/£/g, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) return null;
  return Math.round(value * 100) / 100;
}

export function sanitizeBill(value: unknown): Bill | null {
  if (!value || typeof value !== "object") return null;
  const bill = value as Partial<Bill>;
  if (typeof bill.id !== "string" || typeof bill.name !== "string") return null;
  if (typeof bill.amount !== "number" || !Number.isFinite(bill.amount)) return null;
  if (bill.frequency !== "weekly" && bill.frequency !== "monthly" && bill.frequency !== "yearly") {
    return null;
  }
  if (typeof bill.nextDue !== "string") return null;
  return {
    id: bill.id,
    name: bill.name,
    amount: bill.amount,
    frequency: bill.frequency,
    nextDue: bill.nextDue,
    category: typeof bill.category === "string" ? bill.category : "",
  };
}

export function billsDueSoon(bills: Bill[], today = startOfDay(new Date())) {
  return sortBills(bills).filter((bill) => isSoon(bill.nextDue, today));
}
