"use client";

import { ArrowDownRight, ArrowUpRight, Asterisk, Circle, MoveRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";

export function MotionHero() {
  const heroRef = useRef<HTMLElement>(null);

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    if (!heroRef.current || event.pointerType === "touch") return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    heroRef.current.style.setProperty("--editorial-x", `${x * 12}px`);
    heroRef.current.style.setProperty("--editorial-y", `${y * 10}px`);
    heroRef.current.style.setProperty("--editorial-r", `${x * 2.4}deg`);
  }

  return (
    <section
      ref={heroRef}
      onPointerMove={handlePointerMove}
      className="editorial-hero relative min-h-[calc(100svh-4.75rem)] overflow-hidden bg-[#f3f0e7] text-[#111111]"
      aria-labelledby="home-hero-title"
    >
      <div className="editorial-crosshair editorial-crosshair-a" aria-hidden="true" />
      <div className="editorial-crosshair editorial-crosshair-b" aria-hidden="true" />
      <div className="editorial-ruler absolute inset-y-0 left-[50%] hidden w-px lg:block" aria-hidden="true" />

      <div className="public-container relative grid min-h-[calc(100svh-4.75rem)] grid-rows-[auto_1fr_auto] py-7 sm:py-9">
        <div className="flex items-center justify-between gap-4 border-b border-black/20 pb-4 text-[0.62rem] font-semibold uppercase tracking-[0.18em]">
          <p className="flex items-center gap-2"><span className="editorial-live-dot" />Independent digital product studio</p>
          <p className="hidden items-center gap-2 sm:flex">Issue 01 <span className="text-black/35">/</span> Built for what&apos;s next</p>
        </div>

        <div className="relative grid items-center py-10 lg:grid-cols-[1.08fr_0.92fr] lg:py-6">
          <div className="relative z-20 lg:py-8">
            <p className="mb-5 flex items-center gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#143cff]">
              <Asterisk className="size-4" aria-hidden="true" /> Strategy / Design / Engineering
            </p>
            <h1 id="home-hero-title" className="editorial-headline max-w-[9.4ch] text-[clamp(4.2rem,9vw,9rem)] font-black uppercase leading-[0.77] tracking-[-0.085em]">
              Make <span className="editorial-outline">digital</span> feel obvious.
            </h1>
            <div className="mt-8 grid max-w-2xl gap-7 sm:grid-cols-[1fr_auto] sm:items-end">
              <p className="max-w-md text-base font-medium leading-7 text-black/65 sm:text-lg">
                We turn tangled ideas into products people understand, use, and remember.
              </p>
              <Link href="/contact" className="editorial-cta group">
                <span>Start a project</span><ArrowUpRight className="size-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="editorial-art-wrap relative z-10 mt-8 min-h-[24rem] lg:absolute lg:inset-y-0 lg:-right-[8%] lg:mt-0 lg:w-[62%]">
            <div className="editorial-art-frame absolute inset-0 overflow-hidden rounded-[2.5rem] border-2 border-black bg-[#eee9dd]">
              <Image
                src="/images/arclivo-kinetic-lab.png"
                alt="Abstract kinetic sculpture made from cobalt glass, orange acrylic, chrome and lime accents"
                fill
                priority
                sizes="(min-width: 1024px) 58vw, 100vw"
                className="editorial-art-image object-cover object-[58%_center]"
              />
              <div className="editorial-art-sheen absolute inset-0" aria-hidden="true" />
            </div>
            <div className="editorial-note editorial-note-a"><span>01</span><strong>Ideas</strong><MoveRight className="size-4" /></div>
            <div className="editorial-note editorial-note-b"><Circle className="size-2 fill-current" /><strong>Systems in motion</strong></div>
            <div className="editorial-note editorial-note-c"><span>Useful</span><ArrowDownRight className="size-4" /></div>
          </div>
        </div>

        <div className="relative z-20 flex items-center justify-between gap-6 border-t border-black/20 pt-4 text-[0.62rem] font-semibold uppercase tracking-[0.16em]">
          <div className="flex flex-wrap gap-x-6 gap-y-2"><span>Web</span><span>Products</span><span>AI systems</span><span>Cloud</span></div>
          <Link href="/work" className="hidden items-center gap-2 hover:text-[#143cff] sm:flex">Explore the work <ArrowDownRight className="size-4" /></Link>
        </div>
      </div>

      <div className="editorial-marquee" aria-hidden="true">
        <div>
          {[0, 1].map((copy) => (
            <span key={copy}>Build useful things <Asterisk /> Make complexity disappear <Asterisk /> Design for real life <Asterisk /></span>
          ))}
        </div>
      </div>
    </section>
  );
}
