import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Eye, GitBranch, ShieldCheck } from "lucide-react";

import { PageHero } from "@/components/public/page-hero";
import { ProjectCard } from "@/components/public/project-card";
import { PublicCta } from "@/components/public/public-cta";
import { SectionHeading } from "@/components/public/section-heading";
import { publicPageMetadata, solutionConcepts } from "@/lib/public-site";

export const metadata: Metadata = { ...publicPageMetadata.work, alternates: { canonical: "/work" } };

const readingPrinciples = [
  [Eye, "Experience clarity", "Important information is prioritised around the task, not the database structure."],
  [GitBranch, "Operational fit", "Customer-facing journeys connect cleanly to how teams actually deliver the service."],
  [ShieldCheck, "Responsible foundations", "Accessibility, security, maintainability, and honest claims shape the solution."],
] as const;

export default function WorkPage() {
  return (
    <div className="editorial-home">
      <PageHero
        eyebrow="Selected work"
        title="Ideas made tangible, without invented case-study claims."
        description="This collection shows representative solution concepts and our approach to product problems. It does not present fictional businesses as clients or attach unverified performance numbers to the work."
      >
        <Link href="/contact" className="editorial-cta group">
          <span>Bring us a challenge</span>
          <ArrowUpRight className="size-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" aria-hidden="true" />
        </Link>
      </PageHero>

      {/* Projects grid — cream background */}
      <section className="editorial-work bg-[#f3f0e7] py-20 text-black sm:py-24 lg:py-32">
        <div className="public-container">
          <SectionHeading
            eyebrow="Concepts in context"
            title="Representative product directions, grounded in real operational needs."
            description="These are illustrative solution concepts—not claims about client engagements or measured results."
            theme="editorial"
          />
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {solutionConcepts.map((project, index) => (
              <ProjectCard key={project.title} project={project} priority={index === 0} index={index} />
            ))}
          </div>
          <div className="mt-10 text-right">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 border-b-2 border-black pb-1 text-sm font-bold text-black hover:text-[#143cff]"
            >
              Start your own concept <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Reading principles — blue section */}
      <section className="bg-[#143cff] py-20 text-white sm:py-24 lg:py-32">
        <div className="public-container">
          <SectionHeading
            eyebrow="How to read the work"
            title="The quality is in the decisions behind the screen."
            description="A strong interface is one visible layer of a much larger system."
            align="center"
          />
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {readingPrinciples.map(([Icon, title, copy]) => {
              const CardIcon = Icon as typeof Eye;
              return (
                <article
                  key={String(title)}
                  className="rounded-3xl border-2 border-white/20 bg-white/[0.06] p-7 transition hover:-translate-y-1 hover:border-[#c7ff3d] hover:bg-white/10"
                >
                  <CardIcon aria-hidden="true" className="size-6 text-[#c7ff3d]" />
                  <h2 className="mt-7 text-xl font-semibold text-white">{String(title)}</h2>
                  <p className="mt-3 text-sm leading-6 text-white/70">{String(copy)}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <PublicCta eyebrow="Your context is different" title="Let's make the next example yours—with real evidence behind it." />
    </div>
  );
}
