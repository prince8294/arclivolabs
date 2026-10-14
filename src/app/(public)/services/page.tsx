import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { PageHero } from "@/components/public/page-hero";
import { PublicCta } from "@/components/public/public-cta";
import { SectionHeading } from "@/components/public/section-heading";
import { ServiceCard } from "@/components/public/service-card";
import { processSteps, publicPageMetadata, services } from "@/lib/public-site";

export const metadata: Metadata = { ...publicPageMetadata.services, alternates: { canonical: "/services" } };

const engagementHighlights = [
  { num: "01", label: "Discovery first", copy: "We map the real problem before scoping any deliverable." },
  { num: "02", label: "Transparent decisions", copy: "Every trade-off is visible to you before it is made." },
  { num: "03", label: "Reviewable progress", copy: "Working previews at every phase, not a reveal at the end." },
  { num: "04", label: "Practical handover", copy: "You leave with documentation, not dependency." },
] as const;

export default function ServicesPage() {
  return (
    <div className="editorial-home">
      <PageHero
        eyebrow="Services"
        title="Strategy, design, and engineering around one useful result."
        description="Choose a focused engagement or bring us a broader product challenge. We assemble the right capabilities around the outcome—not a predetermined package."
      >
        <Link href="/contact" className="editorial-cta group">
          <span>Discuss your project</span>
          <ArrowUpRight className="size-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" aria-hidden="true" />
        </Link>
      </PageHero>

      {/* Services grid */}
      <section className="editorial-services bg-[#f3f0e7] py-20 text-black sm:py-24 lg:py-32">
        <div className="public-container">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              eyebrow="Core services"
              title="Everything needed to make a digital product coherent."
              description="From the first decision to the systems behind the interface, every service is connected to how the product should work in practice."
              theme="editorial"
            />
            <Link
              href="/contact"
              className="inline-flex shrink-0 items-center gap-2 rounded-full border-2 border-black px-5 py-3 text-sm font-bold text-black transition hover:bg-black hover:text-white"
            >
              Start a conversation <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {services.map((service, index) => (
              <ServiceCard key={service.title} service={service} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Engagement shape — blue section */}
      <section className="bg-[#143cff] py-20 text-white sm:py-24 lg:py-32">
        <div className="public-container">
          <SectionHeading
            eyebrow="Engagement shape"
            title="A clear path without unnecessary process."
            description="The exact scope changes, but the principles stay consistent: evidence, transparent decisions, reviewable progress, and a practical handover."
          />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {engagementHighlights.map(({ num, label, copy }) => (
              <div
                key={num}
                className="rounded-2xl border-2 border-white/20 bg-white/[0.06] p-6 transition hover:-translate-y-1 hover:border-[#c7ff3d] hover:bg-white/10"
              >
                <span className="font-mono text-xs font-bold text-[#c7ff3d]">{num}</span>
                <h3 className="mt-5 text-xl font-semibold text-white">{label}</h3>
                <p className="mt-3 text-sm leading-6 text-white/70">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process steps — orange section */}
      <section className="editorial-process bg-[#ff5c20] py-20 text-black sm:py-24 lg:py-32">
        <div className="public-container">
          <SectionHeading
            eyebrow="From problem to product"
            title="A process designed to keep momentum and decisions aligned."
            description="Each phase creates something reviewable, reduces uncertainty, and makes the next investment easier to judge."
            theme="editorial"
          />
          <ol className="mt-14 grid gap-px overflow-hidden rounded-[2rem] border-2 border-black bg-black lg:grid-cols-5">
            {processSteps.map(({ number, title, description, icon: Icon }) => (
              <li key={number} className="bg-[#f3f0e7] p-6 lg:min-h-64">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-[#143cff]">{number}</span>
                  <Icon aria-hidden="true" className="size-5 text-black/40" />
                </div>
                <h3 className="mt-10 text-lg font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-black/60">{description}</p>
              </li>
            ))}
          </ol>
          <Link
            href="/process"
            className="mt-8 inline-flex items-center gap-2 border-b-2 border-black pb-1 text-sm font-bold text-black hover:text-[#143cff]"
          >
            See the full process <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </section>

      <PublicCta
        title="Need a website, a platform, or a smarter workflow?"
        description="Tell us what is changing in your business. We will help identify the smallest valuable next move."
      />
    </div>
  );
}
