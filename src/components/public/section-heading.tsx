import type { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  theme = "dark",
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  theme?: "dark" | "light" | "editorial";
  action?: ReactNode;
}) {
  const centered = align === "center";

  const titleClass =
    theme === "light"
      ? "text-slate-950"
      : theme === "editorial"
        ? "text-[#111]"
        : "text-white";

  const descClass =
    theme === "light"
      ? "text-slate-600"
      : theme === "editorial"
        ? "text-black/60"
        : "text-slate-300";

  return (
    <div className={`flex flex-col gap-5 ${centered ? "mx-auto max-w-3xl items-center text-center" : "max-w-3xl"}`}>
      <p className="public-kicker">{eyebrow}</p>
      <h2 className={`text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-4xl lg:text-5xl ${titleClass}`}>
        {title}
      </h2>
      {description ? (
        <p className={`max-w-2xl text-pretty text-base leading-7 sm:text-lg ${descClass}`}>
          {description}
        </p>
      ) : null}
      {action}
    </div>
  );
}
