import { ArrowUpRight } from "lucide-react";
import Image from "next/image";

import type { solutionConcepts } from "@/lib/public-site";

type Concept = (typeof solutionConcepts)[number];

export function ProjectCard({ project, priority = false, index = 0 }: { project: Concept; priority?: boolean; index?: number }) {
  return (
    <article className={`project-editorial group ${index % 2 ? "project-editorial-orange" : "project-editorial-blue"}`}>
      <div className="project-editorial-image relative aspect-[4/3] overflow-hidden border-2 border-black bg-[#e9e4d8]">
        <Image src={project.image} alt={project.alt} fill priority={priority} sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover transition duration-700 group-hover:scale-[1.035]" />
        <span className="absolute left-4 top-4 rounded-full border-2 border-black bg-[#f3f0e7] px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.16em] text-black">Concept / 0{index + 1}</span>
        <span className="absolute bottom-4 right-4 grid size-11 place-items-center rounded-full border-2 border-black bg-[#c7ff3d] text-black shadow-[3px_3px_0_#111]"><ArrowUpRight className="size-5" aria-hidden="true" /></span>
      </div>
      <div className="grid gap-5 pt-7 sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-[#143cff]">{project.category}</p>
          <h3 className="mt-2 text-4xl font-black uppercase tracking-[-0.055em] text-black">{project.title}</h3>
          <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-black/60">{project.description}</p>
        </div>
        <ul className="flex flex-wrap gap-2 sm:max-w-40 sm:justify-end" aria-label="Capabilities represented">
          {project.tags.map((tag) => <li key={tag} className="rounded-full border-2 border-black px-3 py-1.5 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-black">{tag}</li>)}
        </ul>
      </div>
    </article>
  );
}
