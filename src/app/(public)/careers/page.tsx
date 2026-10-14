import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Code2, Lightbulb, Palette } from "lucide-react";

import { PageHero } from "@/components/public/page-hero";
import { PublicCta } from "@/components/public/public-cta";
import { publicPageMetadata } from "@/lib/public-site";

export const metadata: Metadata = { ...publicPageMetadata.careers, alternates: { canonical: "/careers" } };

export default function CareersPage() {
  const disciplines = [[Lightbulb, "Product & strategy", "People who can turn ambiguity into useful decisions."], [Palette, "Design", "Experience and interface designers who connect systems with human needs."], [Code2, "Engineering", "Engineers who care about product quality, maintainability, and clear communication."]] as const;
  return (
    <>
      <PageHero eyebrow="Careers & collaboration" title="Do thoughtful work with people who care about the outcome." description="Arclivo Labs does not currently publish a live vacancy feed. We welcome considered expressions of interest from collaborators whose approach fits our own.">
        <Link href="/contact" className="public-button-primary">Introduce yourself <ArrowRight aria-hidden="true" className="size-4" /></Link>
      </PageHero>
      <section className="bg-[#07111f] py-20 sm:py-24 lg:py-32">
        <div className="public-container grid gap-5 md:grid-cols-3">{disciplines.map(([Icon, title, copy]) => <article key={title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-7"><Icon aria-hidden="true" className="size-6 text-sky-300" /><h2 className="mt-8 text-xl font-semibold text-white">{title}</h2><p className="mt-3 text-sm leading-6 text-slate-400">{copy}</p></article>)}</div>
      </section>
      <section className="bg-slate-50 py-20 text-slate-950 sm:py-24">
        <div className="public-container max-w-4xl"><p className="public-kicker !text-sky-700">A useful introduction</p><h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Show how you think, not just what tools you know.</h2><p className="mt-5 text-lg leading-8 text-slate-600">Share a concise introduction, relevant work, the kind of problems you enjoy, and how you collaborate. Use the contact page and select the closest service, then write “Talent introduction” at the beginning of the context field.</p><p className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">An introduction is not an application to a guaranteed open role. We will only respond when there is a credible fit or a relevant future opportunity.</p></div>
      </section>
      <PublicCta eyebrow="Stay in the orbit" title="Good collaborators are worth knowing before a project appears." description="Send a concise, evidence-backed introduction through the contact page." />
    </>
  );
}
