import { ClientData } from "@/app/_components/providers";
import { ReviewPreview } from "@/app/(frontend)/(app)/review/[id]/review-preview";
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ClientData>
      <ReviewPreview id={id} />
    </ClientData>
  );
}
