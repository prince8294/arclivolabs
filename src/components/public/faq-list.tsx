import { Plus } from "lucide-react";

import { faqs } from "@/lib/public-site";

export function FaqList({ limit }: { limit?: number }) {
  const visible = typeof limit === "number" ? faqs.slice(0, limit) : faqs;
  return (
    <div className="divide-y divide-white/10 border-y border-white/10">
      {visible.map((faq) => (
        <details key={faq.question} className="group py-1">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-left text-lg font-medium text-white marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
            {faq.question}
            <Plus aria-hidden="true" className="size-5 shrink-0 text-sky-300 transition-transform duration-300 group-open:rotate-45" />
          </summary>
          <p className="max-w-3xl pb-7 pr-10 text-base leading-7 text-slate-400">{faq.answer}</p>
        </details>
      ))}
    </div>
  );
}
