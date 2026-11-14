import { publicMetadata } from "@/app/_lib/seo";
import { PricingPreview } from "@/app/(frontend)/(marketing)/pricing/pricing-preview";

export const metadata = publicMetadata("/pricing");

export default function PricingPage() {
  return <PricingPreview />;
}
