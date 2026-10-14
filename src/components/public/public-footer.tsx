import { ArrowDownRight, ArrowUpRight, Asterisk, Circle } from "lucide-react";
import Link from "next/link";

import { companyProfile } from "@/config/company";
import { publicNavigation } from "@/lib/public-site";
import { BrandMark } from "./brand-mark";

const ticker = ["Think clearly", "Design boldly", "Build carefully", "Keep evolving"];

export function PublicFooter() {
  const publicWebsite = /^https?:\/\/(?!localhost(?::|\/|$)|127\.0\.0\.1(?::|\/|$))/i.test(companyProfile.website)
    ? companyProfile.website
    : "";

  return (
    <footer className="editorial-footer overflow-hidden border-t-2 border-black bg-[#f3f0e7] text-black">
      <div className="editorial-footer-ticker overflow-hidden border-b-2 border-black bg-[#ff5c20] py-4" aria-hidden="true">
        <div className="flex w-max items-center">
          {[...ticker, ...ticker].map((item, index) => (
            <span key={`${item}-${index}`} className="flex items-center gap-6 pr-6 text-xs font-black uppercase tracking-[0.2em]"><Asterisk className="size-4" />{item}</span>
          ))}
        </div>
      </div>

      <div className="public-container py-16 sm:py-20 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[1fr_15rem] lg:items-end">
          <div>
            <p className="flex items-center gap-3 text-[0.68rem] font-black uppercase tracking-[0.2em] text-[#143cff]"><Circle className="size-2 fill-current" />One good conversation can change the brief</p>
            <h2 className="mt-7 max-w-[12ch] text-[clamp(4rem,9vw,8.7rem)] font-black uppercase leading-[0.78] tracking-[-0.085em]">
              Got a mess? <span className="editorial-outline">Let&apos;s make</span> it obvious.
            </h2>
          </div>
          <Link href="/contact" className="editorial-footer-cta group">
            <span>Start a project</span>
            <ArrowUpRight className="size-8 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-20 grid gap-12 border-t-2 border-black pt-10 md:grid-cols-[1.3fr_0.7fr_0.7fr]">
          <div className="max-w-md">
            <BrandMark theme="light" />
            <p className="mt-6 text-base font-medium leading-7 text-black/60">A digital product studio for teams that want less noise, sharper thinking, and software that earns its place.</p>
            <p className="mt-8 inline-flex items-center gap-2 text-[0.65rem] font-black uppercase tracking-[0.18em]"><span className="editorial-live-dot" />Available for the right next project</p>
          </div>
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-black/40">Explore</p>
            <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm font-semibold md:grid-cols-1">
              {publicNavigation.slice(1).map((item) => <li key={item.href}><Link className="group inline-flex items-center gap-2 border-b border-transparent hover:border-black" href={item.href}>{item.label}<ArrowDownRight aria-hidden="true" className="size-3 opacity-0 transition group-hover:opacity-100" /></Link></li>)}
              <li><Link className="border-b border-transparent hover:border-black" href="/careers">Careers</Link></li>
              <li><Link className="border-b border-transparent hover:border-black" href="/faq">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-black/40">Connect</p>
            <div className="mt-5 space-y-3 text-sm font-semibold">
              {companyProfile.email ? <a className="block break-all underline decoration-2 underline-offset-4" href={`mailto:${companyProfile.email}`}>{companyProfile.email}</a> : <Link className="block underline decoration-2 underline-offset-4" href="/contact">Project enquiry</Link>}
              {companyProfile.phone ? <a className="block" href={`tel:${companyProfile.phone}`}>{companyProfile.phone}</a> : null}
              {publicWebsite ? <a className="block break-all" href={publicWebsite}>{publicWebsite.replace(/^https?:\/\//, "")}</a> : null}
              <Link className="block" href="/login">Secure portal login</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden border-t-2 border-black bg-[#143cff] px-4 pt-7 text-white sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-[90rem] flex-col gap-4 pb-7 text-xs font-semibold sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Arclivo Labs. Built with intent.</p>
          <div className="flex gap-6"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div>
        </div>
        <p className="editorial-footer-word select-none whitespace-nowrap text-center text-[clamp(5rem,17vw,15rem)] font-black uppercase leading-[0.66] tracking-[-0.09em]" aria-hidden="true">Arclivo</p>
      </div>
    </footer>
  );
}
