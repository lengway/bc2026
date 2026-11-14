import { ActivityGallery } from "../activity-gallery";

export default async function Page({
  searchParams,
}: PageProps<"/design/history">) {
  const { state } = await searchParams;
  return (
    <ActivityGallery
      screen="history"
      initialState={typeof state === "string" ? state : undefined}
    />
  );
}
