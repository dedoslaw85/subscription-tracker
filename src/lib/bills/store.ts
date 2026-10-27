import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { format } from "date-fns";
import { billsDueSoon, formatGBP, frequencyLabel, normalizeBill, sampleBills, sanitizeBill, type Bill } from "@/lib/bills/model";
import { sanitizeReceipt, trimReceipts, type Receipt } from "@/lib/receipts/model";

const NOTIFIED_KEY = "subscription-tracker-notified-on";

type BillsState = {
  bills: Bill[];
  receipts: Receipt[];
  notifications: boolean;
  adsRemoved: boolean;
  seeded: boolean;
  showSampleHint: boolean;
  hydrated: boolean;
  setHydrated: (hydrated: boolean) => void;
  setNotifications: (notifications: boolean) => void;
  removeAds: () => void;
  addBill: (bill: Bill) => void;
  updateBill: (id: string, bill: Bill) => void;
  removeBill: (id: string) => void;
  addReceipt: (receipt: Receipt) => void;
  updateReceipt: (id: string, patch: Partial<Omit<Receipt, "id">>) => void;
  removeReceipt: (id: string) => void;
};

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

export const useBills = create<BillsState>()(
  persist(
    (set, get) => ({
      bills: [],
      receipts: [],
      notifications: false,
      adsRemoved: false,
      seeded: false,
      showSampleHint: false,
      hydrated: false,
      setHydrated: (hydrated) => set({ hydrated }),
      setNotifications: (notifications) => set({ notifications }),
      removeAds: () => set({ adsRemoved: true }),
      addBill: (bill) => set({ bills: [...get().bills, normalizeBill(bill)], showSampleHint: false }),
      updateBill: (id, bill) =>
        set({
          bills: get().bills.map((item) => (item.id === id ? normalizeBill(bill) : item)),
          showSampleHint: false,
        }),
      removeBill: (id) =>
        set({
          bills: get().bills.filter((item) => item.id !== id),
          receipts: get().receipts.map((item) => (item.billId === id ? { ...item, billId: null } : item)),
          showSampleHint: false,
        }),
      addReceipt: (receipt) => set({ receipts: trimReceipts([receipt, ...get().receipts]) }),
      updateReceipt: (id, patch) =>
        set({
          receipts: get().receipts.map((item) => (item.id === id ? { ...item, ...patch, id: item.id } : item)),
        }),
      removeReceipt: (id) => set({ receipts: get().receipts.filter((item) => item.id !== id) }),
    }),
    {
      name: "subscription-tracker",
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? memoryStorage() : localStorage,
      ),
      skipHydration: true,
      partialize: (state) => ({
        bills: state.bills,
        receipts: state.receipts,
        notifications: state.notifications,
        adsRemoved: state.adsRemoved,
        seeded: state.seeded,
        showSampleHint: state.showSampleHint,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

export function prepareBills() {
  const state = useBills.getState();
  const source = Array.isArray(state.bills) ? state.bills : [];
  let bills = source.flatMap((item) => {
    const clean = sanitizeBill(item);
    return clean ? [normalizeBill(clean)] : [];
  });
  const receiptSource = Array.isArray(state.receipts) ? state.receipts : [];
  const receipts = trimReceipts(receiptSource.flatMap((item) => {
    const clean = sanitizeReceipt(item);
    return clean ? [clean] : [];
  }));
  let seeded = state.seeded;
  let showSampleHint = state.showSampleHint;
  if (!seeded && bills.length === 0) {
    bills = sampleBills();
    seeded = true;
    showSampleHint = true;
  }
  const same =
    seeded === state.seeded &&
    showSampleHint === state.showSampleHint &&
    bills.length === state.bills.length &&
    bills.every(
      (bill, index) =>
        bill.id === state.bills[index]?.id && bill.nextDue === state.bills[index]?.nextDue,
    );
  const storedReceipts = state.receipts ?? [];
  const receiptsSame =
    receipts.length === storedReceipts.length &&
    receipts.every(
      (receipt, index) =>
        receipt.id === storedReceipts[index]?.id &&
        receipt.billId === storedReceipts[index]?.billId &&
        receipt.total === storedReceipts[index]?.total &&
        receipt.image === storedReceipts[index]?.image,
    );
  if (!same || !receiptsSame) useBills.setState({ bills, receipts, seeded, showSampleHint });
}

export function notifyDueBills() {
  const { notifications, bills } = useBills.getState();
  if (!notifications) return;
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  const soon = billsDueSoon(bills);
  if (soon.length === 0) return;
  const today = format(new Date(), "yyyy-MM-dd");
  if (localStorage.getItem(NOTIFIED_KEY) === today) return;
  const first = soon[0];
  if (!first) return;
  const title =
    soon.length === 1
      ? `${first.name} is due ${first.nextDue === today ? "today" : "tomorrow"}`
      : `${soon.length} bills are due soon`;
  const body =
    soon.length === 1
      ? `${formatGBP(first.amount)} · ${frequencyLabel(first.frequency)}`
      : soon.map((bill) => bill.name).join(", ");
  try {
    new Notification(title, { body });
    localStorage.setItem(NOTIFIED_KEY, today);
  } catch {
    // The browser refused the notification. The in-app reminder still shows.
  }
}
