"use client";

import Link from "next/link";
import { ErrorPanel } from "@/app/_components/error-panel";
import { StartCaseButton } from "@/app/_components/start-case-button";
import { useOwnedCertificates } from "@/app/_hooks/owner-activity-hooks";
import { CertificatesScreen } from "@/screens/owner-activity/certificates-screen";
import { Button } from "@/ui/primitives/button";

export function Certificates() {
  const certificates = useOwnedCertificates();

  return (
    <CertificatesScreen
      result={certificates.data}
      loading={certificates.isPending}
      error={
        certificates.error && (
          <ErrorPanel
            error={certificates.error}
            retry={() => void certificates.refetch()}
          />
        )
      }
      practice={
        <Button asChild className="min-h-11" variant="outline">
          <Link href="/path">Explore skills</Link>
        </Button>
      }
      start={<StartCaseButton label="Start a case" />}
    />
  );
}
