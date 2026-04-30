import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/legal-shell";
import { listLegalDocs, loadLegalDoc } from "@/lib/legal-content";

export function generateStaticParams() {
  return listLegalDocs().map((d) => ({ slug: d.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const doc = loadLegalDoc(params.slug);
  if (!doc) return { title: "Документ не найден — Offi" };
  return {
    title: `${doc.title} — Offi`,
    description: `Редакция от ${doc.updated}. Документ Offi в соответствии с законодательством РФ.`,
  };
}

export default function LegalDocPage({ params }: { params: { slug: string } }) {
  const doc = loadLegalDoc(params.slug);
  if (!doc) notFound();
  return <LegalShell doc={doc} />;
}
