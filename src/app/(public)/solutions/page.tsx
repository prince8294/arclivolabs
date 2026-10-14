import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, X } from "lucide-react";

import { PageHero } from "@/components/public/page-hero";
import { PublicCta } from "@/components/public/public-cta";
import { SectionHeading } from "@/components/public/section-heading";
import { industries, publicPageMetadata } from "@/lib/public-site";

export const metadata: Metadata = { ...publicPageMetadata.solutions, alternates: { canonical: "/solutions" } };

export default function SolutionsPage() {
  const outcomes = [
    "A faster path from enquiry to action",
    "Fewer disconnected spreadsheets and hand-offs",
    "A consistent customer experience across devices",
    "Better visibility for the people running the service",
    "A maintainable technical base for future changes",
  ];

  return (
    <div className="editorial-home">
      <PageHero
        eyebrow="Solutions"
        title="Connect the customer experience to the way your business actually works."
        description="The strongest digital products do more than look polished. They make an important journey clearer from end to end."
      >
        <Link href="/contact" className="editorial-cta group">
          <span>Explore the right solution</span>
          <ArrowUpRight className="size-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" aria-hidden="true" />
        </Link>
      </PageHero>

      {/* Outcome-led delivery — cream section */}
      <section className="bg-[#f3f0e7] py-20 text-black sm:py-24 lg:py-32">
        <div className="public-container grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading
              eyebrow="Outcome-led delivery"
              title="Start with what needs to change—not a feature catalogue."
              description="We map the people, information, and decisions around a problem, then shape the right combination of interface, automation, and infrastructure."
              theme="editorial"
            />
            <ul className="mt-8 space-y-4">
              {outcomes.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-black/70">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-black bg-[#c7ff3d] text-black">
                    <Check aria-hidden="true" className="size-3.5" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/contact"
              className="mt-9 inline-flex items-center gap-2 rounded-full border-2 border-black bg-[#143cff] px-5 py-3 text-sm font-bold text-white shadow-[4px_4px_0_#111] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#111]"
            >
              Start a conversation <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <div className="relative overflow-hidden rounded-[2rem] border-2 border-black bg-[#eee9dd] shadow-[12px_12px_0_#143cff]">
            <Image
              src="/images/case-healthcare.webp"
              alt="Connected operational software displayed on laptop and phone"
              width={1448}
              height={1086}
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="aspect-[4/3] w-full object-cover"
            />
            <span className="absolute bottom-4 left-4 rounded-full border-2 border-black bg-[#f3f0e7] px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.15em] text-black">
              Illustrative concept
            </span>
          </div>
        </div>
      </section>

      {/* Industry context — blue section */}
      <section className="editorial-industries bg-[#ff5c20] py-20 text-black sm:py-24 lg:py-32">
        <div className="public-container">
          <SectionHeading
            eyebrow="Industry context"
            title="Common patterns, adapted to the organisation."
            description="Industry familiarity helps us ask better questions. It never replaces learning how your service really runs."
            theme="editorial"
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {industries.map(({ name, copy, icon: Icon }) => (
              <article key={name} className="rounded-2xl border-2 border-black bg-[#f3f0e7] p-6 shadow-[5px_5px_0_#111] transition hover:-translate-y-1 hover:shadow-[8px_8px_0_#111]">
                <div className="grid size-12 place-items-center rounded-2xl border-2 border-black bg-[#143cff] text-white">
                  <Icon aria-hidden="true" className="size-5" />
                </div>
                <h2 className="mt-6 text-xl font-semibold text-black">{name}</h2>
                <p className="mt-3 text-sm leading-6 text-black/65">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Considered fit — lime section */}
      <section className="border-y-2 border-black bg-[#c7ff3d] py-20 sm:py-24">
        <div className="public-container grid gap-10 rounded-[2rem] lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-black/50">A considered fit</p>
            <h2 className="mt-5 text-3xl font-black uppercase tracking-[-0.055em] text-black sm:text-4xl">
              When Arclivo Labs may be a good partner.
            </h2>
          </div>
          <div className="grid gap-5 text-sm leading-6">
            <p className="flex gap-3 items-start text-black/80">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 border-black bg-white text-black">
                <Check className="size-3.5" aria-hidden="true" />
              </span>
              You have a meaningful business problem and can involve the people who understand it.
            </p>
            <p className="flex gap-3 items-start text-black/80">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 border-black bg-white text-black">
                <Check className="size-3.5" aria-hidden="true" />
              </span>
              You value clear trade-offs, regular review, and a maintainable result.
            </p>
            <p className="flex gap-3 items-start text-black/50">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 border-black bg-black/10 text-black">
                <X className="size-3.5" aria-hidden="true" />
              </span>
              You need a guaranteed revenue number, an overnight clone, or unsupported claims presented as proof.
            </p>
          </div>
        </div>
      </section>

      <PublicCta title="Let's identify the smallest solution that can create meaningful value." />
    </div>
  );
}
