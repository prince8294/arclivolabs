import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Website terms", description: "Terms for use of the Arclivo Labs public website and secure portals.", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <section className="bg-slate-50 py-16 text-slate-950 sm:py-24">
      <article className="public-container max-w-3xl">
        <p className="public-kicker !text-sky-700">Legal</p><h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Website terms</h1>
        <p className="mt-5 text-sm text-slate-500">Last updated: 7 October 2026</p>
        <div className="mt-10 space-y-9 text-base leading-7 text-slate-700">
          <section><h2 className="text-xl font-semibold text-slate-950">General information</h2><p className="mt-3">This website provides general information about Arclivo Labs capabilities and working approach. It is not an offer, guarantee, or substitute for a written proposal and signed agreement.</p></section>
          <section><h2 className="text-xl font-semibold text-slate-950">Illustrative work</h2><p className="mt-3">Items identified as illustrative concepts are design and product examples. They must not be read as client identities, delivered engagements, endorsements, or verified performance results.</p></section>
          <section><h2 className="text-xl font-semibold text-slate-950">Project enquiries</h2><p className="mt-3">An enquiry does not create a client relationship, obligation to accept work, confidentiality agreement, or commitment on scope, timing, price, or availability. Those terms are established only in separate written documentation.</p></section>
          <section><h2 className="text-xl font-semibold text-slate-950">Portal access</h2><p className="mt-3">Secure portals are for authorised users. Credentials must be kept confidential, and users must not attempt to access data, functions, or accounts outside their assigned permissions.</p></section>
          <section><h2 className="text-xl font-semibold text-slate-950">Content and availability</h2><p className="mt-3">Content may change as services evolve. While reasonable care is taken, the public site may be unavailable or contain errors, and no uninterrupted availability is promised.</p></section>
          <section><h2 className="text-xl font-semibold text-slate-950">Contact</h2><p className="mt-3">Questions about these terms can be sent through the <Link className="font-semibold text-sky-700 hover:underline" href="/contact">contact page</Link>.</p></section>
        </div>
      </article>
    </section>
  );
}
