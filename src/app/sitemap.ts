import type { MetadataRoute } from "next";

import { appConfig } from "@/config/app";

const publicRoutes = ["", "/services", "/work", "/solutions", "/about", "/process", "/contact", "/careers", "/faq", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((path) => ({
    url: new URL(path || "/", appConfig.url).toString(),
    lastModified: new Date("2026-10-07"),
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/contact" ? 0.9 : 0.7,
  }));
}
