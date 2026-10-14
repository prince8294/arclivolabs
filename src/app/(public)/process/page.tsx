import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, MessageSquareText } from "lucide-react";

import { PageHero } from "@/components/public/page-hero";
import { PublicCta } from "@/components/public/public-cta";
import { SectionHeading } from "@/components/public/section-heading";
import { processSteps, publicPageMetadata } from "@/lib/public-site";

export const metadata: Metadata = { ...publicPageMetadata.process, alternates: { canonical: "/process" } };

export default function ProcessPage() {
  return (
    <div className="editorial-home">
      <PageHero
        eyebrow="Our process"
        title="Enough structure for confidence. Enough flexibility for discovery."
        description="We use a transparent, phase-based process that keeps important decisions visible and turns uncertainty into reviewable progress."
      >
        <Link href="/contact" className="editorial-cta group">
          <span>Plan a discovery conversation</span>
          <ArrowUpRight className="size-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" aria-hidden="true" />
        </Link>
      </PageHero>

      {/* Five phases — cream background */}
      <section className="editorial-process bg-[#f3f0e7] py-20 text-black sm:py-24 lg:py-32">
        <div className="public-container">
          <SectionHeading
            eyebrow="Five connected phases"
            title="Every step should reduce a meaningful risk."
            description="The pace and artefacts adapt to the project. The purpose of each phase remains clear."
            theme="editorial"
          />
          <ol className="mt-14 grid gap-px overflow-hidden rounded-[2rem] border-2 border-black bg-black lg:grid-cols-5">
            {processSteps.map(({ number, title, description, icon: Icon }, idx) => (
              <li
                key={number}
                className={`p-6 lg:min-h-72 ${
                  idx === 1
                    ? "bg-[#c7ff3d]"
                    : idx === 3
                      ? "bg-[#ff5c20]"
                      : "bg-[#f3f0e7]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-[#143cff]">{number}</span>
                  <Icon aria-hidden="true" className="size-5 text-black/40" />
                </div>
                <h3 className="mt-10 text-xl font-semibold text-black">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-black/60">{description}</p>
              </li>
            ))}
          </ol>
          <Link
            href="/contact"
            className="mt-8 inline-flex items-center gap-2 border-b-2 border-black pb-1 text-sm font-bold text-black hover:text-[#143cff]"
          >
            Start with discovery <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </section>

      {/* Timeline — alternating layout */}
      <section className="bg-[#143cff] py-20 text-white sm:py-24 lg:py-32">
        <div className="public-container">
          <SectionHeading
            eyebrow="Inside each phase"
            title="What you can expect at every stage."
            description="Each phase has clear inputs, outputs, and a decision point that moves the project forward."
          />
          <ol className="relative mt-14 space-y-6 before:absolute before:bottom-8 before:left-[1.55rem] before:top-8 before:w-px before:bg-white/20 lg:before:left-1/2">
            {processSteps.map(({ number, title, description, icon: Icon }, index) => (
              <li
                key={number}
                className={`relative grid items-center gap-6 lg:grid-cols-2 lg:gap-20 ${index % 2 ? "" : "lg:text-right"}`}
              >
                <div
                  className={`${
                    index % 2 ? "lg:col-start-2" : ""
                  } rounded-3xl border-2 border-white/20 bg-white/[0.06] p-6 backdrop-blur-sm sm:p-8`}
                >
                  <div className={`flex items-center gap-3 ${index % 2 ? "" : "lg:justify-end"}`}>
                    <Icon aria-hidden="true" className="size-5 text-[#c7ff3d]" />
                    <span className="font-mono text-xs font-bold text-[#c7ff3d]">{number}</span>
                  </div>
                  <h2 className="mt-6 text-2xl font-semibold text-white">{title}</h2>
                  <p className="mt-3 text-sm leading-7 text-white/70">{description}</p>
                </div>
                <span className="absolute left-[1.08rem] top-8 grid size-4 place-items-center rounded-full border-4 border-[#143cff] bg-[#c7ff3d] lg:left-1/2 lg:-translate-x-1/2" />
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Communication callout — lime section */}
      <section className="border-y-2 border-black bg-[#c7ff3d] py-16 text-black sm:py-20">
        <div className="public-container grid gap-8 lg:grid-cols-[auto_1fr] lg:items-start">
          <div className="grid size-14 place-items-center rounded-2xl border-2 border-black bg-black text-[#c7ff3d]">
            <MessageSquareText aria-hidden="true" className="size-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-[-0.04em] text-black sm:text-3xl">
              Communication is part of the product work.
            </h2>
            <p className="mt-4 max-w-3xl text-base font-medium leading-7 text-black/70">
              You should know what is being decided, what has changed, what remains uncertain, and what we need from you. Regular checkpoints and working previews keep feedback useful instead of ceremonial.
            </p>
          </div>
        </div>
      </section>

      <PublicCta title="A clear first step can save months of wrong work." />
    </div>
  );
}
