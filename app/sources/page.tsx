import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sourcesArticle } from "@/components/layout/dbip-view";
import { DBIP_SOURCES_LABEL, dbipAttributionEnabled } from "@/lib/dbip-attribution";

export const metadata: Metadata = {
  title: DBIP_SOURCES_LABEL,
};

export default function SourcesPage() {
  if (!dbipAttributionEnabled()) notFound();
  return sourcesArticle();
}
