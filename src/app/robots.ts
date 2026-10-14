import type { MetadataRoute } from "next";

import { appConfig } from "@/config/app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/services", "/work", "/solutions", "/about", "/process", "/contact", "/careers", "/faq", "/privacy", "/terms"], disallow: ["/admin/", "/marketing/", "/employee/", "/client/", "/api/"] },
    ],
    sitemap: new URL("/sitemap.xml", appConfig.url).toString(),
  };
}
