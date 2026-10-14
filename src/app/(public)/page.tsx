import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { FaqList } from "@/components/public/faq-list";
import { MotionHero } from "@/components/public/motion-hero";
import { ProjectCard } from "@/components/public/project-card";
import { PublicCta } from "@/components/public/public-cta";
import { SectionHeading } from "@/components/public/section-heading";
import { ServiceCard } from "@/components/public/service-card";
import { capabilities, industries, processSteps, publicPageMetadata, services, solutionConcepts } from "@/lib/public-site";

export const metadata: Metadata = {
  ...publicPageMetadata.home,
  alternates: { canonical: "/" },
};

const credibility = [
  ["01 / Discover", "Understand the real business problem."],
  ["02 / Design", "Make complex workflows feel simple."],
  ["03 / Engineer", "Build secure, scalable foundations."],
  ["04 / Evolve", "Learn, improve, and keep moving."],
] as const;

export default function HomePage() {
  return (
    <div className="editorial-home">
      <MotionHero />

      <section className="editorial-principles relative overflow-hidden border-y-2 border-black bg-[#ff5c20] py-8 text-black">
        <div className="public-container grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {credibility.map(([title, copy]) => (
            <div key={title} className="border-white/10 py-2 lg:border-l lg:pl-6 first:lg:border-l-0 first:lg:pl-0">
              <p className="text-sm font-black uppercase tracking-[-0.02em] text-black">{title}</p><p className="mt-1 text-xs font-medium leading-5 text-black/65">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="editorial-services bg-[#f3f0e7] py-20 text-black sm:py-24 lg:py-32">
        <div className="public-container">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading eyebrow="What we build" title="One product partner from first question to reliable release." description="Focused capabilities that connect the customer experience with the systems your team needs behind it." />
            <Link href="/services" className="inline-flex shrink-0 items-center gap-2 rounded-full border-2 border-black px-5 py-3 text-sm font-bold text-black transition hover:bg-black hover:text-white">View all services <ArrowRight aria-hidden="true" className="size-4" /></Link>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {services.slice(0, 8).map((service, index) => <ServiceCard key={service.title} service={service} index={index} />)}
          </div>
        </div>
      </section>

      <section className="editorial-why bg-[#143cff] py-20 text-white sm:py-24 lg:py-32">
        <div className="public-container grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
          <div className="relative overflow-hidden rounded-[2rem] border-2 border-white/70 bg-white shadow-[12px_12px_0_#ff5c20]">
            <Image src="/images/arclivo-product-studio-v2.png" alt="A multidisciplinary product team sketching interfaces and arranging physical prototypes around a studio table" width={1536} height={1024} sizes="(min-width: 1024px) 52vw, 100vw" className="aspect-[4/3] w-full object-cover" />
          </div>
          <div>
            <p className="public-kicker !text-[#c7ff3d]">Why Arclivo</p>
            <h2 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Product thinking and engineering in the same room.</h2>
            <p className="mt-6 text-lg leading-8 text-white/75">We connect strategy, interface decisions, and technical execution from the beginning. That keeps the product coherent and reduces expensive hand-offs.</p>
            <ul className="mt-8 space-y-4">
              {["The business outcome shapes the feature list.", "Critical workflows are designed before they are coded.", "Technical choices are explained in practical terms.", "Launch is treated as a learning point, not the finish line."].map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-white/85"><span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[#c7ff3d] text-black"><Check aria-hidden="true" className="size-3.5" /></span>{item}</li>)}
            </ul>
            <Link href="/about" className="mt-9 inline-flex items-center gap-2 border-b border-white pb-1 text-sm font-semibold text-white hover:text-[#c7ff3d]">How we work <ArrowRight aria-hidden="true" className="size-4" /></Link>
          </div>
        </div>
      </section>

      <section className="editorial-work bg-[#f3f0e7] py-20 text-black sm:py-24 lg:py-32">
        <div className="public-container">
          <SectionHeading eyebrow="Selected work" title="Representative product directions, grounded in real operational needs." description="These are illustrative solution concepts—not claims about client engagements or measured results." />
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {solutionConcepts.map((project, index) => <ProjectCard key={project.title} project={project} priority={index === 0} index={index} />)}
          </div>
          <div className="mt-8 text-right"><Link href="/work" className="inline-flex items-center gap-2 border-b-2 border-black pb-1 text-sm font-bold text-black hover:text-[#143cff]">Explore the thinking behind the work <ArrowRight aria-hidden="true" className="size-4" /></Link></div>
        </div>
      </section>

      <section className="editorial-capabilities border-y-2 border-black bg-[#c7ff3d] py-20 text-black sm:py-24">
        <div className="public-container">
          <SectionHeading eyebrow="Capabilities" title="A connected toolkit for ambitious digital work." align="center" />
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            {capabilities.map(({ label, icon: Icon }) => <div key={label} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200"><Icon aria-hidden="true" className="size-4 text-sky-300" />{label}</div>)}
          </div>
        </div>
      </section>

      <section className="editorial-process bg-[#f3f0e7] py-20 text-black sm:py-24 lg:py-32">
        <div className="public-container">
          <SectionHeading eyebrow="From problem to product" title="A process designed to keep momentum and decisions aligned." description="Each phase creates something reviewable, reduces uncertainty, and makes the next investment easier to judge." theme="light" />
          <ol className="mt-14 grid gap-px overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-200 lg:grid-cols-5">
            {processSteps.map(({ number, title, description, icon: Icon }) => <li key={number} className="bg-white p-6 lg:min-h-72"><div className="flex items-center justify-between"><span className="font-mono text-xs text-sky-700">{number}</span><Icon aria-hidden="true" className="size-5 text-slate-400" /></div><h3 className="mt-10 text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{description}</p></li>)}
          </ol>
          <Link href="/process" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-900">See the full process <ArrowRight aria-hidden="true" className="size-4" /></Link>
        </div>
      </section>

      <section className="editorial-industries bg-[#ff5c20] py-20 text-black sm:py-24 lg:py-32">
        <div className="public-container grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <SectionHeading eyebrow="Built around your context" title="Experience across the workflows that make services run." description="We do not force one template across every organisation. We learn the operating model, then choose the right product shape." />
          <div className="grid gap-4 sm:grid-cols-2">
            {industries.map(({ name, copy, icon: Icon }) => <article key={name} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><Icon aria-hidden="true" className="size-5 text-sky-300" /><h3 className="mt-5 font-semibold text-white">{name}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p></article>)}
          </div>
        </div>
      </section>

      <section className="editorial-faq bg-[#f3f0e7] py-20 text-black sm:py-24 lg:py-28">
        <div className="public-container grid gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
          <div><SectionHeading eyebrow="Questions, answered" title="Clarity before commitment." description="The details that usually matter when choosing a product partner." /><Link href="/faq" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-sky-300 hover:text-sky-200">View every answer <ArrowRight aria-hidden="true" className="size-4" /></Link></div>
          <FaqList limit={5} />
        </div>
      </section>

      <PublicCta />
    </div>
  );
}
