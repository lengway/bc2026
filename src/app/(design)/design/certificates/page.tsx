import { ActivityGallery } from "../activity-gallery";

export default async function Page({
  searchParams,
}: PageProps<"/design/certificates">) {
  const { state } = await searchParams;
  return (
    <ActivityGallery
      screen="certificates"
      initialState={typeof state === "string" ? state : undefined}
    />
  );
}
