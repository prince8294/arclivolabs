import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy notice", description: "How the Arclivo Labs public website handles information.", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <section className="bg-slate-50 py-16 text-slate-950 sm:py-24">
      <article className="public-container max-w-3xl">
        <p className="public-kicker !text-sky-700">Legal</p><h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Privacy notice</h1>
        <p className="mt-5 text-sm text-slate-500">Last updated: 7 October 2026</p>
        <div className="mt-10 space-y-9 text-base leading-7 text-slate-700">
          <section><h2 className="text-xl font-semibold text-slate-950">Public website enquiries</h2><p className="mt-3">The public contact form prepares a message in your own email application. The website does not submit or store that form data. If you send the prepared email, your email provider and the receiving mailbox process the message under their respective policies.</p></section>
          <section><h2 className="text-xl font-semibold text-slate-950">Secure portal data</h2><p className="mt-3">The Arclivo Labs management portals are access-controlled business systems. Authorised users may have account, project, communication, document, and operational records processed to provide the relevant service. Access is role-based and should only be used by authorised people.</p></section>
          <section><h2 className="text-xl font-semibold text-slate-950">Technical information</h2><p className="mt-3">Hosting and security infrastructure may process standard technical logs such as request time, IP address, device or browser information, and error details. These records may be used to operate, secure, and diagnose the service.</p></section>
          <section><h2 className="text-xl font-semibold text-slate-950">Your choices</h2><p className="mt-3">Do not include sensitive personal data in a general project enquiry. For a question about information associated with an existing engagement, use your established project contact or the secure portal.</p></section>
          <section><h2 className="text-xl font-semibold text-slate-950">Questions</h2><p className="mt-3">Use the <Link className="font-semibold text-sky-700 hover:underline" href="/contact">contact page</Link> for a privacy question. This notice describes the current website behaviour and may be updated when the service changes.</p></section>
        </div>
      </article>
    </section>
  );
}
