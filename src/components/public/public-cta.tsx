import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function PublicCta({
  eyebrow = "Ready when you are",
  title = "Turn the next business challenge into a product people can use.",
  description = "Share the context, constraints, and result you are aiming for. We will help make the next step clear.",
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
}) {
  return (
    <section className="bg-[#f3f0e7] px-4 py-16 text-black sm:px-6 lg:px-8 lg:py-24">
      <div className="public-container overflow-hidden rounded-[2rem] border-2 border-black bg-[#ff5c20] px-6 py-12 shadow-[12px_12px_0_#111] sm:px-10 lg:flex lg:items-end lg:justify-between lg:gap-12 lg:px-14 lg:py-16">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-black">{eyebrow}</p>
          <h2 className="mt-5 text-balance text-3xl font-black uppercase tracking-[-0.055em] text-black sm:text-4xl lg:text-5xl">{title}</h2>
          <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-black/65 sm:text-lg">{description}</p>
        </div>
        <Link href="/contact" className="mt-8 inline-flex shrink-0 items-center gap-3 rounded-full border-2 border-black bg-[#c7ff3d] px-6 py-4 text-sm font-bold text-black shadow-[5px_5px_0_#111] transition hover:-translate-y-1 hover:shadow-[8px_8px_0_#111] lg:mt-0">
          Start a conversation <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </section>
  );
}
