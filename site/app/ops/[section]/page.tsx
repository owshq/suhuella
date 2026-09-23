import { OperationsPage } from "@/components/operations/OperationsPage";
import { operationsSectionFromSlug } from "@/lib/operations/routes";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OperationsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const mapped = operationsSectionFromSlug(section);
  if (!mapped) notFound();
  return <OperationsPage section={mapped} />;
}
