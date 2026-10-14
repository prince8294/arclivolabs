import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import type { PublicService } from "@/lib/public-site";

export function ServiceCard({ service, index }: { service: PublicService; index: number }) {
  const Icon = service.icon;
  return (
    <article className={`group relative overflow-hidden rounded-3xl border p-6 transition duration-300 hover:-translate-y-1 sm:p-7 ${service.featured ? "border-sky-300/30 bg-sky-300/[0.08]" : "border-white/10 bg-white/[0.045]"}`}>
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.07] text-sky-300"><Icon aria-hidden="true" className="size-5" /></span>
        <span className="font-mono text-xs text-slate-600">0{index + 1}</span>
      </div>
      <h3 className="mt-7 text-xl font-semibold tracking-[-0.025em] text-white">{service.title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-400">{service.summary}</p>
      <p className="mt-5 border-t border-white/10 pt-5 text-sm font-medium text-slate-200">{service.outcome}</p>
      <Link href="/contact" aria-label={`Discuss ${service.title}`} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-sky-300 hover:text-sky-200">
        Discuss this service <ArrowUpRight aria-hidden="true" className="size-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </Link>
    </article>
  );
}
