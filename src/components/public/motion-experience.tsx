"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

export function MotionExperience({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const auraRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const items = Array.from(root.querySelectorAll<HTMLElement>("main section:not(:first-child), [data-reveal]"));
    items.forEach((item, index) => {
      item.classList.add("motion-reveal");
      item.style.setProperty("--reveal-order", String(index % 4));
    });
    root.classList.add("motion-ready");

    if (reducedMotion) {
      items.forEach((item) => item.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -9% 0px", threshold: 0.08 }
    );
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [pathname]);

  function moveAura(event: React.PointerEvent<HTMLDivElement>) {
    if (!auraRef.current || event.pointerType === "touch") return;
    auraRef.current.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
    auraRef.current.style.opacity = "1";
  }

  return (
    <div ref={rootRef} className="motion-shell" onPointerMove={moveAura} onPointerLeave={() => { if (auraRef.current) auraRef.current.style.opacity = "0"; }}>
      <div ref={auraRef} className="public-pointer-aura" aria-hidden="true" />
      {children}
    </div>
  );
}
