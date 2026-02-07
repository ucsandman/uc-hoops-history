import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import SmartHeader from "@/components/SmartHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bearcats Since 2012",
  description:
    "UC Men’s Basketball since 2012 — seasons, players, runs, and draft-board debates.",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="grain min-h-dvh text-zinc-100">
          <SmartHeader>
            <header className="border-b border-white/10 bg-black/35 backdrop-blur">
              <div className="mx-auto flex max-w-6xl flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="flex items-center gap-3">
                  <Link
                    href="/"
                    className="group relative h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-black/25 sm:h-14 sm:w-14"
                    aria-label="Home"
                  >
                    <Image
                      src="/icon.png"
                      alt="Bearcats Since 2012"
                      fill
                      sizes="56px"
                      className="object-cover"
                      style={{ objectPosition: "50% 50%" }}
                      priority
                    />
                    <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
                  </Link>
                  <div>
                    <Link href="/" className="font-black tracking-tight text-[17px] leading-tight sm:text-[19px]">
                      Bearcats Since 2012
                    </Link>
                    <div className="text-[12px] text-zinc-400 sm:text-[13px]">Halftime app for arguing</div>
                  </div>
                </div>

                <nav className="-mx-1 flex w-full items-center gap-1.5 overflow-x-auto px-1 pb-1 text-[13px] [scrollbar-width:none] sm:mx-0 sm:w-auto sm:gap-2 sm:overflow-visible sm:px-0 sm:pb-0 sm:text-sm">
                  <style>{"nav::-webkit-scrollbar{display:none}"}</style>
                  <Link className="sb-chip rounded-xl px-3 py-1.5 text-zinc-200 hover:text-white hover:bg-white/5" href="/players">
                    Players
                  </Link>
                  <Link className="sb-chip rounded-xl px-3 py-1.5 text-zinc-200 hover:text-white hover:bg-white/5" href="/draft">
                    Draft
                  </Link>
                  <Link className="sb-chip rounded-xl px-3 py-1.5 text-zinc-200 hover:text-white hover:bg-white/5" href="/compare">
                    Compare
                  </Link>
                  <Link className="sb-chip rounded-xl px-3 py-1.5 text-zinc-200 hover:text-white hover:bg-white/5" href="/leaderboard">
                    Leaderboard
                  </Link>
                  <Link className="sb-chip rounded-xl px-3 py-1.5 text-zinc-200 hover:text-white hover:bg-white/5" href="/me">
                    My Drafts
                  </Link>
                  <Link className="sb-chip rounded-xl px-3 py-1.5 text-zinc-200 hover:text-white hover:bg-white/5" href="/random">
                    Random 5
                  </Link>
                </nav>
              </div>
            </header>
          </SmartHeader>
          <main className="mx-auto max-w-6xl px-3 pt-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:px-4 sm:pt-10 sm:pb-10">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-zinc-500">
            Sports-Reference data (scraped) • Unofficial fan project • Built for sharing
          </footer>
        </div>
      </body>
    </html>
  );
}
