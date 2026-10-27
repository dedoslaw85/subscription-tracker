import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { BillsGate } from "@/components/bills-gate";
import appCss from "../styles.css?url";

const APP_NAME = "Subscription Tracker";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content: "A calm place to track subscriptions and recurring bills on this device.",
      },
      { name: "theme-color", content: "#F7F6F3" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <BillsGate>
            <Outlet />
          </BillsGate>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
  notFoundComponent: NotFound,
});

function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center bg-bg px-6 text-fg">
      <h1 className="text-2xl font-medium">That page isn’t here</h1>
      <p className="mt-2 text-muted">The bill tracker is still on the home tab.</p>
      <Link
        to="/"
        className="mt-6 inline-flex h-14 items-center justify-center rounded-control bg-accent px-4 text-on-accent"
      >
        Back home
      </Link>
    </main>
  );
}
