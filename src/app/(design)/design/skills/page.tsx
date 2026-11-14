import type { Metadata } from "next";
import { SkillsGallery } from "./skills-gallery";

export const metadata: Metadata = {
  title: "Skills gallery",
  robots: { index: false },
};

export default function SkillsGalleryPage() {
  return <SkillsGallery />;
}
