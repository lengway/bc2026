import { ClientData } from "@/app/_components/providers";
import { CasePreview } from "@/app/(frontend)/(app)/case/[id]/case-preview";
export default async function CasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ClientData>
      <CasePreview id={id} />
    </ClientData>
  );
}
