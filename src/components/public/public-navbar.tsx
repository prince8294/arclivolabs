"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { publicNavigation } from "@/lib/public-site";
import { BrandMark } from "./brand-mark";

export function PublicNavbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-black/20 bg-[#f3f0e7]/90 text-black backdrop-blur-xl">
      <div className="public-container flex h-[4.75rem] items-center justify-between gap-6">
        <BrandMark theme="light" />
        <nav aria-label="Primary navigation" className="hidden items-center gap-1 xl:flex">
          {publicNavigation.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                  active ? "bg-black text-white" : "text-black/65 hover:bg-[#ff5c20] hover:text-black"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-2 xl:flex">
          <Link className="rounded-full px-4 py-2.5 text-sm font-semibold text-black/65 hover:bg-black/5 hover:text-black" href="/login">
            Client login
          </Link>
          <Link className="rounded-full border-2 border-black bg-[#c7ff3d] px-5 py-2.5 text-sm font-semibold text-black shadow-[3px_3px_0_#111] transition hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#111]" href="/contact">
            Start a project
          </Link>
        </div>
        <button
          type="button"
          className="grid size-11 place-items-center rounded-full border-2 border-black text-black transition hover:bg-[#ff5c20] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#143cff] xl:hidden"
          aria-expanded={open}
          aria-controls="public-mobile-menu"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
        </button>
      </div>
      {open ? (
        <div id="public-mobile-menu" className="border-t border-black/15 bg-[#f3f0e7] xl:hidden">
          <nav aria-label="Mobile navigation" className="public-container grid gap-1 py-5">
            {publicNavigation.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-xl px-4 py-3 text-base ${active ? "bg-black text-white" : "text-black/65 hover:bg-[#ff5c20] hover:text-black"}`}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-black/15 pt-5">
              <Link onClick={() => setOpen(false)} className="flex items-center justify-center rounded-full border-2 border-black px-3 py-3 text-sm font-semibold" href="/login">Client login</Link>
              <Link onClick={() => setOpen(false)} className="flex items-center justify-center rounded-full border-2 border-black bg-[#c7ff3d] px-3 py-3 text-sm font-semibold shadow-[3px_3px_0_#111]" href="/contact">Start a project</Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
