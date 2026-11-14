import type { Metadata } from "next";
import { AppUxGallery } from "./app-ux-gallery";
export const metadata: Metadata = {
  title: "Application design gallery",
  robots: { index: false },
};
export default function AppUxDesignPage() {
  return <AppUxGallery />;
}
