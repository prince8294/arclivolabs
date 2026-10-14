import type { Metadata } from "next";

import { FaqList } from "@/components/public/faq-list";
import { PageHero } from "@/components/public/page-hero";
import { PublicCta } from "@/components/public/public-cta";
import { publicPageMetadata } from "@/lib/public-site";

export const metadata: Metadata = { ...publicPageMetadata.faq, alternates: { canonical: "/faq" } };

export default function FaqPage() {
  return (
    <><PageHero eyebrow="Frequently asked questions" title="The practical details, without the sales fog." description="Straight answers about fit, scope, delivery, commercial terms, and what happens after launch." /><section className="bg-[#07111f] py-16 sm:py-20 lg:py-28"><div className="public-container max-w-4xl"><FaqList /></div></section><PublicCta title="Still deciding whether the fit is right?" description="Send the question and context. A useful no is better than an unclear maybe." /></>
  );
}
