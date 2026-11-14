"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type DisablePublicLinkRequest,
  type OwnedCertificates,
} from "@/contracts";
import { useOwnedCertificates } from "@/app/_hooks/owner-activity-hooks";
import { accountApi } from "@/app/_lib/account-api";
import { ErrorPanel } from "@/app/_components/error-panel";
import { Button } from "@/ui/primitives/button";
import { formatSkill } from "@/ui/lib/format";
import { SettingsLoading, SettingsSection } from "../settings-section";

type LinkEntry = DisablePublicLinkRequest & {
  title: string;
  issuedAt: string;
  revokedAt: string | null;
};

function readLinks(data: OwnedCertificates): LinkEntry[] {
  return [
    ...data.skills
      .filter((cert) => cert.hasPublicLink || cert.revokedAt)
      .map((cert) => ({
        kind: "skill" as const,
        slug: cert.slug,
        title: `${formatSkill(cert.skill)} · Level ${cert.level}`,
        issuedAt: cert.issuedAt,
        revokedAt: cert.revokedAt,
      })),
    ...data.caseRecords
      .filter((cert) => cert.hasPublicLink || cert.revokedAt)
      .map((cert) => ({
        kind: "case_record" as const,
        slug: cert.slug,
        title: cert.title,
        issuedAt: cert.issuedAt,
        revokedAt: cert.revokedAt,
      })),
  ].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}

const formatDate = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export function PrivacySettings() {
  const certificates = useOwnedCertificates();
  const cache = useQueryClient();
  const disable = useMutation({
    mutationFn: accountApi.disableLink,
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["owner-certificates"] }),
        cache.invalidateQueries({ queryKey: ["review"] }),
        cache.invalidateQueries({ queryKey: ["skill-path"] }),
      ]);
    },
  });
  if (certificates.isPending)
    return <SettingsLoading label="Loading public links…" />;
  if (certificates.isError)
    return (
      <ErrorPanel
        error={certificates.error}
        retry={() => void certificates.refetch()}
      />
    );
  const links = readLinks(certificates.data);
  return (
    <SettingsSection
      title="Public links"
      description="Anyone with a public link can view the published result. Disabling a link preserves the result in your account."
    >
      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You have no published links.
        </p>
      ) : (
        <ul className="divide-y border-y">
          {links.map(({ kind, slug, title, issuedAt, revokedAt }) => (
            <li
              key={`${kind}:${slug}`}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0 space-y-1">
                <p className="break-words text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">
                  {kind === "skill" ? "Skill certificate" : "Case record"} ·{" "}
                  <time className="font-mono tabular-nums" dateTime={issuedAt}>
                    {formatDate.format(new Date(issuedAt))}
                  </time>
                </p>
              </div>
              {revokedAt ? (
                <span className="text-sm text-muted-foreground">
                  Link disabled
                </span>
              ) : (
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={disable.isPending}
                  aria-label={`Disable link for ${title}`}
                  onClick={() => disable.mutate({ kind, slug })}
                >
                  Disable link
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {disable.isSuccess && (
        <p role="status" className="text-sm text-ink">
          Public link disabled.
        </p>
      )}
      {disable.isError && (
        <ErrorPanel
          error={disable.error}
          retry={() => {
            if (disable.variables) disable.mutate(disable.variables);
          }}
        />
      )}
    </SettingsSection>
  );
}
