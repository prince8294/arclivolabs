import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Compass, Handshake, ShieldCheck, Waypoints } from "lucide-react";

import { PageHero } from "@/components/public/page-hero";
import { PublicCta } from "@/components/public/public-cta";
import { SectionHeading } from "@/components/public/section-heading";
import { publicPageMetadata } from "@/lib/public-site";

export const metadata: Metadata = { ...publicPageMetadata.about, alternates: { canonical: "/about" } };

export default function AboutPage() {
  const values = [
    [Compass, "Clarity", "We make scope, assumptions, risks, and trade-offs understandable before they become expensive."],
    [Handshake, "Partnership", "Good products are built with clients, users, and delivery teams—not handed down to them."],
    [ShieldCheck, "Integrity", "We do not invent credentials, client outcomes, testimonials, or certainty we cannot support."],
    [Waypoints, "Momentum", "We favour reviewable progress and practical decisions over theatre and unnecessary ceremony."],
  ] as const;

  return (
    <div className="editorial-home">
      <PageHero
        eyebrow="About Arclivo Labs"
        title="A digital product studio built for close, useful collaboration."
        description="We help organisations clarify product decisions, design better experiences, and build the software foundations needed to deliver them."
      >
        <Link href="/process" className="editorial-cta group">
          <span>See how we work</span>
          <ArrowUpRight className="size-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" aria-hidden="true" />
        </Link>
      </PageHero>

      {/* Point of view — cream section with image */}
      <section className="bg-[#f3f0e7] py-20 text-black sm:py-24 lg:py-32">
        <div className="public-container grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
          <div className="overflow-hidden rounded-[2rem] border-2 border-black shadow-[12px_12px_0_#143cff]">
            <Image
              src="/images/arclivo-team-studio.webp"
              alt="A product team collaborating around a software interface"
              width={1774}
              height={887}
              priority
              sizes="(min-width: 1024px) 52vw, 100vw"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
          <div>
            <SectionHeading
              eyebrow="Our point of view"
              title="Useful software begins with a shared understanding."
              description="Technology only helps when it reflects the people, decisions, and operations around it. We start by understanding that system, then shape the smallest coherent product that can create value."
              theme="editorial"
            />
            <p className="mt-6 text-base font-medium leading-7 text-black/65">
              That means design and engineering stay connected, difficult trade-offs are discussed early, and progress is shown in working form wherever possible.
            </p>
            <Link
              href="/process"
              className="mt-8 inline-flex items-center gap-2 border-b-2 border-black pb-1 text-sm font-bold text-black hover:text-[#143cff]"
            >
              See our process <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Values — blue section */}
      <section className="bg-[#143cff] py-20 text-white sm:py-24 lg:py-32">
        <div className="public-container">
          <SectionHeading
            eyebrow="Working principles"
            title="The standards behind the work."
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {values.map(([Icon, title, copy]) => {
              const CardIcon = Icon as typeof Compass;
              return (
                <article
                  key={title}
                  className="rounded-2xl border-2 border-white/20 bg-white/[0.06] p-7 transition hover:-translate-y-1 hover:border-[#c7ff3d] hover:bg-white/10"
                >
                  <div className="grid size-12 place-items-center rounded-2xl border-2 border-white/20 bg-white/10">
                    <CardIcon aria-hidden="true" className="size-6 text-[#c7ff3d]" />
                  </div>
                  <h2 className="mt-8 text-xl font-semibold text-white">{title}</h2>
                  <p className="mt-3 text-sm leading-6 text-white/70">{copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* What we are not — orange section */}
      <section className="editorial-principles border-y-2 border-black bg-[#ff5c20] py-16 text-black sm:py-20">
        <div className="public-container">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["01 / Discover", "Understand the real business problem."],
              ["02 / Design", "Make complex workflows feel simple."],
              ["03 / Engineer", "Build secure, scalable foundations."],
              ["04 / Evolve", "Learn, improve, and keep moving."],
            ].map(([title, copy]) => (
              <div key={title} className="border-white/20 py-2 lg:border-l lg:pl-6 first:lg:border-l-0 first:lg:pl-0">
                <p className="text-sm font-black uppercase tracking-[-0.02em] text-black">{title}</p>
                <p className="mt-1 text-xs font-medium leading-5 text-black/65">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PublicCta eyebrow="Build with us" title="Bring a complex problem. Leave with a clearer product direction." />
    </div>
  );
}
