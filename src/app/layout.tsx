import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Bebas_Neue, Barlow } from "next/font/google";
import SmartHeader from "@/components/SmartHeader";
import "./globals.css";

const bodyFont = Barlow({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

const displayFont = Bebas_Neue({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "UC Hoops History",
  description: "UC Men’s Basketball history — seasons, players, drafts, and matchup recaps.",
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
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <div className="grain min-h-dvh text-zinc-100">
          <SmartHeader>
            <header className="border-b-[3px] border-[var(--court-line)] bg-[var(--arena-wood)] shadow-[0_4px_20px_rgba(0,0,0,0.6)]">
              <div className="mx-auto flex max-w-6xl flex-col gap-2 px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="flex items-center gap-3">
                  <Link
                    href="/"
                    className="group relative h-14 w-14 overflow-hidden rounded border-2 border-[var(--court-line)] bg-[var(--arena-dark)] shadow-[0_0_15px_rgba(255,149,0,0.2)] sm:h-16 sm:w-16"
                    aria-label="Home"
                  >
                    <Image
                      src="/icon.png"
                      alt="UC Hoops History"
                      fill
                      sizes="64px"
                      className="object-cover"
                      style={{ objectPosition: "50% 50%" }}
                      priority
                    />
                    <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
                  </Link>
                  <div>
                    <Link
                      href="/"
                      className="tracking-[0.08em] text-[26px] leading-none sm:text-[32px] [font-family:var(--font-display)] uppercase text-[var(--scoreboard-amber)] [text-shadow:0_0_10px_var(--led-glow),0_2px_4px_rgba(0,0,0,0.8)]"
                    >
                      UC Hoops History
                    </Link>
                    <div className="mt-1 text-[16px] text-[var(--muted-cream)] sm:text-[18px] tracking-wide">Draft · Sim · Talk Trash</div>
                  </div>
                </div>

                <nav className="-mx-1 flex w-full items-center gap-2 overflow-x-auto px-1 pb-1 text-[17px] [scrollbar-width:none] sm:mx-0 sm:w-auto sm:gap-2.5 sm:overflow-visible sm:px-0 sm:pb-0 sm:text-[19px]">
                  <style>{"nav::-webkit-scrollbar{display:none}"}</style>
                  <Link className="sb-chip rounded px-4 py-2.5 text-[var(--vintage-cream)] hover:text-[var(--scoreboard-amber)] hover:shadow-[0_0_12px_var(--led-glow)] transition-all uppercase tracking-[0.05em]" href="/players">
                    Players
                  </Link>
                  <Link className="sb-chip rounded px-4 py-2.5 text-[var(--vintage-cream)] hover:text-[var(--scoreboard-amber)] hover:shadow-[0_0_12px_var(--led-glow)] transition-all uppercase tracking-[0.05em]" href="/draft">
                    Draft
                  </Link>
                  <Link className="sb-chip rounded px-4 py-2.5 text-[var(--vintage-cream)] hover:text-[var(--scoreboard-amber)] hover:shadow-[0_0_12px_var(--led-glow)] transition-all uppercase tracking-[0.05em]" href="/compare">
                    Compare
                  </Link>
                  <Link className="sb-chip rounded px-4 py-2.5 text-[var(--vintage-cream)] hover:text-[var(--scoreboard-amber)] hover:shadow-[0_0_12px_var(--led-glow)] transition-all uppercase tracking-[0.05em]" href="/leaderboard">
                    Leaders
                  </Link>
                  <Link className="sb-chip rounded px-4 py-2.5 text-[var(--vintage-cream)] hover:text-[var(--scoreboard-amber)] hover:shadow-[0_0_12px_var(--led-glow)] transition-all uppercase tracking-[0.05em]" href="/me">
                    My Drafts
                  </Link>
                  <Link className="sb-chip rounded px-4 py-2.5 text-[var(--vintage-cream)] hover:text-[var(--scoreboard-amber)] hover:shadow-[0_0_12px_var(--led-glow)] transition-all uppercase tracking-[0.05em]" href="/about">
                    About
                  </Link>
                </nav>
              </div>
            </header>
          </SmartHeader>
          <main className="mx-auto max-w-6xl px-3 pt-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:px-4 sm:pt-10 sm:pb-10">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 pb-10 text-base text-[var(--muted-cream)] tracking-wide border-t border-[var(--court-line)]/30 pt-8 mt-12">
            <div className="text-center">
              Sports-Reference data (scraped) • Unofficial fan project • Built for sharing
            </div>
            <div className="text-center mt-2 text-sm text-[var(--court-line)] uppercase tracking-[0.1em]">
              Est. Since the Oscar Robertson Era
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
