import type { Metadata } from "next";
import { ReviewGallery } from "./review-gallery";

export const metadata: Metadata = { title: "Design · Review", robots: { index: false } };

export default function DesignReviewPage() {
  return <ReviewGallery />;
}
