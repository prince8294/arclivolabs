import Link from "next/link";

export function BrandMark({ compact = false, theme = "dark" }: { compact?: boolean; theme?: "dark" | "light" }) {
  return (
    <Link
      href="/"
      className={`group inline-flex items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5c20] focus-visible:ring-offset-4 ${theme === "light" ? "focus-visible:ring-offset-[#f3f0e7]" : "focus-visible:ring-offset-[#07111f]"}`}
      aria-label="Arclivo Labs home"
    >
      <span className={`relative grid size-9 place-items-center overflow-hidden rounded-xl border-2 ${theme === "light" ? "border-black bg-[#143cff] shadow-[4px_4px_0_#ff5c20]" : "border-sky-300/30 bg-sky-300/10 shadow-[0_0_35px_rgba(56,189,248,0.16)]"}`}>
        <span className={`absolute left-1.5 top-1.5 size-3 rounded-[4px] transition-transform duration-300 group-hover:translate-x-0.5 ${theme === "light" ? "bg-[#ff5c20]" : "bg-sky-300"}`} />
        <span className={`absolute bottom-1.5 right-1.5 size-3 rounded-[4px] transition-transform duration-300 group-hover:-translate-x-0.5 ${theme === "light" ? "bg-[#c7ff3d]" : "bg-violet-400"}`} />
        <span className="relative size-2.5 rotate-45 rounded-[2px] bg-white" />
      </span>
      {!compact ? (
        <span className="leading-none">
          <span className={`block text-[0.92rem] font-semibold tracking-[0.18em] ${theme === "light" ? "text-black" : "text-white"}`}>ARCLIVO</span>
          <span className={`mt-1 block text-[0.62rem] font-medium tracking-[0.42em] ${theme === "light" ? "text-black/55" : "text-slate-400"}`}>LABS</span>
        </span>
      ) : null}
    </Link>
  );
}
