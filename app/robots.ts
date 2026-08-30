import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: "https://10thegoat.com/sitemap.xml", host: "https://10thegoat.com" };
}
