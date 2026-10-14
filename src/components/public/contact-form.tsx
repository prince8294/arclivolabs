"use client";

import { ArrowUpRight, Mail, ShieldCheck } from "lucide-react";
import { type FormEvent, useState } from "react";

const inputClass = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100";

export function ContactForm({ destinationEmail }: { destinationEmail: string }) {
  const [message, setMessage] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!destinationEmail) {
      setMessage("The direct project email is not configured yet. Please use the secure client portal if you already have access.");
      return;
    }

    const values = new FormData(event.currentTarget);
    const name = String(values.get("name") ?? "").trim();
    const company = String(values.get("company") ?? "").trim();
    const replyTo = String(values.get("email") ?? "").trim();
    const phone = String(values.get("phone") ?? "").trim();
    const service = String(values.get("service") ?? "").trim();
    const budget = String(values.get("budget") ?? "").trim();
    const timeline = String(values.get("timeline") ?? "").trim();
    const details = String(values.get("details") ?? "").trim();
    const subject = encodeURIComponent(`Project enquiry from ${name}${company ? ` — ${company}` : ""}`);
    const body = encodeURIComponent([
      `Name: ${name}`,
      `Company: ${company || "Not provided"}`,
      `Reply-to email: ${replyTo}`,
      `Phone: ${phone || "Not provided"}`,
      `Service: ${service}`,
      `Budget range: ${budget || "Not provided"}`,
      `Preferred timeline: ${timeline || "Not provided"}`,
      "",
      "Project context:",
      details,
    ].join("\n"));

    setMessage("Your email app is opening. Review the message there and send it when ready.");
    window.location.href = `mailto:${destinationEmail}?subject=${subject}&body=${body}`;
  }

  return (
    <form onSubmit={submit} className="" aria-describedby="contact-form-note">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-800">Your name <span aria-hidden="true" className="text-sky-600">*</span><input required name="name" autoComplete="name" className={inputClass} placeholder="How should we address you?" /></label>
        <label className="text-sm font-medium text-slate-800">Company<input name="company" autoComplete="organization" className={inputClass} placeholder="Organisation or brand" /></label>
        <label className="text-sm font-medium text-slate-800">Email <span aria-hidden="true" className="text-sky-600">*</span><input required type="email" name="email" autoComplete="email" className={inputClass} placeholder="you@company.com" /></label>
        <label className="text-sm font-medium text-slate-800">Phone<input name="phone" type="tel" autoComplete="tel" className={inputClass} placeholder="Optional" /></label>
        <label className="text-sm font-medium text-slate-800">What do you need? <span aria-hidden="true" className="text-sky-600">*</span>
          <select required name="service" defaultValue="" className={inputClass}>
            <option value="" disabled>Select a service</option>
            <option>Website design & development</option><option>Web application</option><option>Mobile application</option><option>UI/UX design</option><option>AI & automation</option><option>Cloud & backend systems</option><option>E-commerce solution</option><option>Maintenance & support</option><option>Not sure yet</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-800">Budget range
          <select name="budget" defaultValue="" className={inputClass}>
            <option value="">Prefer to discuss</option><option>Under ₹1 lakh</option><option>₹1–3 lakh</option><option>₹3–8 lakh</option><option>₹8 lakh+</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-800 sm:col-span-2">Preferred timeline<input name="timeline" className={inputClass} placeholder="For example: launch within 12 weeks" /></label>
        <label className="text-sm font-medium text-slate-800 sm:col-span-2">Project context <span aria-hidden="true" className="text-sky-600">*</span><textarea required name="details" rows={6} className={`${inputClass} resize-y`} placeholder="What are you trying to improve, who is it for, and what constraints should we know?" /></label>
      </div>
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p id="contact-form-note" className="flex max-w-md items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-sky-600" />This form prepares an email on your device. Nothing is submitted or stored by the website.</p>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-black bg-[#111] px-6 py-3 text-sm font-bold text-white shadow-[4px_4px_0_#143cff] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#143cff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
        >
          {destinationEmail ? <Mail aria-hidden="true" className="size-4" /> : null} Prepare enquiry <ArrowUpRight aria-hidden="true" className="size-4" />
        </button>
      </div>
      {message ? <p role="status" className="mt-5 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800">{message}</p> : null}
    </form>
  );
}
