import type { Metadata } from "next";
import { Clock3, Mail, MapPin, ShieldCheck } from "lucide-react";

import { ContactForm } from "@/components/public/contact-form";
import { PageHero } from "@/components/public/page-hero";
import { companyProfile } from "@/config/company";
import { publicPageMetadata } from "@/lib/public-site";

export const metadata: Metadata = { ...publicPageMetadata.contact, alternates: { canonical: "/contact" } };

export default function ContactPage() {
  return (
    <div className="editorial-home">
      <PageHero
        eyebrow="Start a project"
        title="Tell us what you are trying to change."
        description="A useful first message includes the problem, who it affects, what exists today, and any timeline or budget constraints. You do not need a finished specification."
      />

      {/* Contact form section — cream */}
      <section className="bg-[#f3f0e7] py-16 text-black sm:py-20 lg:py-28">
        <div className="public-container grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
          <aside>
            <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-[#143cff]">Before we talk</p>
            <h2 className="mt-5 text-3xl font-black uppercase tracking-[-0.055em] text-black">
              A focused enquiry helps us respond usefully.
            </h2>
            <p className="mt-5 text-base font-medium leading-7 text-black/65">
              We review the context first, then decide whether a discovery conversation is the right next step. Sending this form does not create a contract or guarantee availability.
            </p>
            <div className="mt-9 space-y-6 border-t-2 border-black/15 pt-8 text-sm">
              <div className="flex gap-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border-2 border-black bg-[#c7ff3d]">
                  <Clock3 aria-hidden="true" className="size-4 text-black" />
                </div>
                <div>
                  <p className="font-bold text-black">Thoughtful response</p>
                  <p className="mt-1 text-black/60">We reply after reviewing the context—not with an automated promise.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border-2 border-black bg-[#ff5c20]">
                  <ShieldCheck aria-hidden="true" className="size-4 text-black" />
                </div>
                <div>
                  <p className="font-bold text-black">No hidden submission</p>
                  <p className="mt-1 text-black/60">The form prepares an email and does not silently store your details.</p>
                </div>
              </div>
              {companyProfile.email ? (
                <div className="flex gap-4">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl border-2 border-black bg-[#143cff]">
                    <Mail aria-hidden="true" className="size-4 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-black">Prefer direct email?</p>
                    <a
                      className="mt-1 block break-all text-[#143cff] underline underline-offset-4 hover:text-black"
                      href={`mailto:${companyProfile.email}`}
                    >
                      {companyProfile.email}
                    </a>
                  </div>
                </div>
              ) : null}
              {companyProfile.registeredAddress ? (
                <div className="flex gap-4">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl border-2 border-black bg-[#eee9dd]">
                    <MapPin aria-hidden="true" className="size-4 text-black" />
                  </div>
                  <div>
                    <p className="font-bold text-black">Registered address</p>
                    <p className="mt-1 text-black/60">{companyProfile.registeredAddress}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </aside>

          {/* Form wrapper styled for editorial */}
          <div className="rounded-[2rem] border-2 border-black bg-white p-6 shadow-[8px_8px_0_#111] sm:p-8 lg:p-10">
            <ContactForm destinationEmail={companyProfile.email} />
          </div>
        </div>
      </section>
    </div>
  );
}
