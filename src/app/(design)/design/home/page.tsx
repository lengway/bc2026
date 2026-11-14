import type { Metadata } from "next";
import { HomeGallery } from "./home-gallery";

export const metadata: Metadata = {
  title: "Home design gallery",
  robots: { index: false },
};

export default function HomeDesignPage() {
  return <HomeGallery />;
}
