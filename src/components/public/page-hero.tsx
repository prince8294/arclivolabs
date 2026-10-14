"use client";

import { Asterisk } from "lucide-react";
import type { ReactNode } from "react";
import { useRef } from "react";

export function PageHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  const heroRef = useRef<HTMLElement>(null);

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    if (!heroRef.current || event.pointerType === "touch") return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    heroRef.current.style.setProperty("--page-hero-x", `${x * 8}px`);
    heroRef.current.style.setProperty("--page-hero-y", `${y * 6}px`);
  }

  return (
    <section
      ref={heroRef}
      onPointerMove={handlePointerMove}
      className="editorial-page-hero relative overflow-hidden border-b-2 border-black bg-[#f3f0e7] py-20 text-black sm:py-24 lg:py-32"
    >
      {/* Crosshairs */}
      <div className="editorial-crosshair editorial-crosshair-a" aria-hidden="true" />
      <div className="editorial-crosshair editorial-crosshair-b" aria-hidden="true" />

      {/* Vertical ruler */}
      <div className="editorial-ruler absolute inset-y-0 left-[50%] hidden w-px lg:block" aria-hidden="true" />

      {/* Floating accent blobs */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-[#143cff] opacity-[0.07]"
        aria-hidden="true"
        style={{ filter: "blur(60px)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-16 left-12 size-72 rounded-full bg-[#ff5c20] opacity-[0.06]"
        aria-hidden="true"
        style={{ filter: "blur(80px)" }}
      />

      <div className="public-container relative z-10">
        {/* Top bar */}
        <div className="mb-10 flex items-center justify-between gap-4 border-b border-black/20 pb-4 text-[0.62rem] font-semibold uppercase tracking-[0.18em]">
          <p className="flex items-center gap-2">
            <span className="editorial-live-dot" />
            Independent digital product studio
          </p>
          <p className="hidden items-center gap-2 sm:flex">
            <Asterisk className="size-3" aria-hidden="true" />
            {eyebrow}
          </p>
        </div>

        <div className="max-w-5xl">
          <p className="editorial-page-eyebrow mb-5 flex items-center gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#143cff]">
            <Asterisk className="size-4" aria-hidden="true" />
            {eyebrow}
          </p>
          <h1 className="editorial-headline max-w-[16ch] text-[clamp(2.6rem,6vw,5.5rem)] font-black uppercase leading-[0.82] tracking-[-0.055em] text-black">
            {title}
          </h1>
          <p className="mt-8 max-w-2xl text-base font-medium leading-7 text-black/65 sm:text-lg">
            {description}
          </p>
          {children ? <div className="mt-9">{children}</div> : null}
        </div>
      </div>

      {/* Bottom marquee strip */}
      <div className="editorial-marquee mt-10" aria-hidden="true">
        <div>
          {[0, 1].map((copy) => (
            <span key={copy}>
              {eyebrow} <Asterisk /> Strategy · Design · Engineering <Asterisk />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
