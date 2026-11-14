import type { Metadata } from "next";
import { DesignGallery } from "./gallery";

export const metadata: Metadata = {
  title: "Design gallery",
  robots: { index: false },
};

/** Every design-system component on fixtures. Replaces Storybook. */
export default function DesignPage() {
  return <DesignGallery />;
}
