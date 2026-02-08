"use client";

import { useEffect, useRef, useState } from "react";

export default function SmartHeader({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastY.current = window.scrollY;

    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;

      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY.current;

        // Don't hide at very top.
        if (y < 50) {
          setHidden(false);
        } else if (dy > 12) {
          // scrolling down - hide header
          setHidden(true);
        } else if (dy < -8) {
          // scrolling up - show header
          setHidden(false);
        }

        lastY.current = y;
        ticking.current = false;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={
        "sticky top-0 z-50 transition-transform duration-200 will-change-transform " +
        (hidden ? "-translate-y-full" : "translate-y-0")
      }
    >
      {children}
    </div>
  );
}
