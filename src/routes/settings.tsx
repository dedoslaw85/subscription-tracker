import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { notifyDueBills, useBills } from "@/lib/bills/store";

export const Route = createFileRoute("/settings")({ component: Settings });

function Settings() {
  const notifications = useBills((state) => state.notifications);
  const adsRemoved = useBills((state) => state.adsRemoved);
  const setNotifications = useBills((state) => state.setNotifications);
  const removeAds = useBills((state) => state.removeAds);
  const [note, setNote] = useState("");
  const [confirmAds, setConfirmAds] = useState(false);

  async function toggleNotifications() {
    if (notifications) {
      setNotifications(false);
      setNote("");
      return;
    }
    if (typeof Notification === "undefined") {
      setNote("This browser doesn’t support notifications.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setNote("Notifications stay off until this browser allows them.");
      return;
    }
    setNotifications(true);
    setNote("On. You’ll get a reminder the day before, when the app is open.");
    notifyDueBills();
  }

  return (
    <AppShell>
      <div className="px-5 pt-8 pb-8">
        <h1 className="text-2xl text-fg">Settings</h1>
        <p className="mt-2 text-sm text-pretty text-muted">
          Kept on this device. Nothing is uploaded.
        </p>

        <button
          type="button"
          role="switch"
          aria-checked={notifications}
          onClick={() => void toggleNotifications()}
          className="mt-8 flex w-full items-center gap-4 rounded-card border border-line bg-surface px-4 py-4 text-left shadow-card"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-base text-fg">Notifications</span>
            <span className="mt-1 block text-sm text-pretty text-muted">
              A gentle reminder the day before a bill is due, while the app is open.
            </span>
          </span>
          <span
            className={`relative h-8 w-14 shrink-0 rounded-full ${notifications ? "bg-accent" : "bg-line"}`}
            aria-hidden
          >
            <span
              className={`absolute top-1 size-6 rounded-full bg-surface transition-transform ${
                notifications ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </span>
        </button>
        {note ? <p className="mt-3 text-sm text-pretty text-muted">{note}</p> : null}

        <section className="mt-8 rounded-card border border-line bg-surface px-4 py-5 shadow-card">
          <h2 className="text-lg text-fg">Remove ads</h2>
          {adsRemoved ? (
            <p className="mt-2 text-sm text-pretty text-muted">
              The banner stays hidden on this device.
            </p>
          ) : confirmAds ? (
            <div className="mt-3">
              <p className="text-sm text-pretty text-muted">
                The banner hides for good on this device. You won’t be charged in this browser
                version — a store build would be a one-time £1.99 purchase.
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <Button
                  onClick={() => {
                    removeAds();
                    setConfirmAds(false);
                  }}
                >
                  Remove ads
                </Button>
                <Button variant="quiet" onClick={() => setConfirmAds(false)}>
                  Not now
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-sm text-pretty text-muted">
                Hide the single banner at the bottom of Home, List, and Settings.
              </p>
              <Button className="mt-4" onClick={() => setConfirmAds(true)}>
                Remove ads
              </Button>
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-lg text-fg">About</h2>
          <p className="mt-2 text-sm text-pretty text-muted">
            Subscription Tracker adds up what you pay each month, and rolls the next due date
            forward when a payment passes.
          </p>
          <p className="mt-3 text-sm text-muted">Version 1.0</p>
        </section>
      </div>
    </AppShell>
  );
}
