import { publicMetadata } from "@/app/_lib/seo";
import { ChallengeScreen } from "@/screens/challenge";

export const metadata = publicMetadata("/challenge");

export default function ChallengePage() {
  return <ChallengeScreen />;
}
