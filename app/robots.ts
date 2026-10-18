import type { MetadataRoute } from "next";
import { robotsDocument } from "@/lib/site-index";

export default function robots(): MetadataRoute.Robots {
  return robotsDocument();
}
