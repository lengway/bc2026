"use client";

import { useState } from "react";
import { Toaster } from "sonner";
import type { CaseHistoryFilters } from "@/contracts";
import {
  activityCertificates,
  activityHistory,
} from "@/mocks/scenarios/owner-activity";
import { CertificatesScreen } from "@/screens/owner-activity/certificates-screen";
import { HistoryScreen } from "@/screens/owner-activity/history-screen";
import { Button } from "@/ui/primitives/button";

export type GalleryState = "new" | "practicing" | "certified";

export function ActivityGallery({
  screen,
  initialState,
}: {
  screen: "history" | "certificates";
  initialState?: string;
}) {
  const [state, setState] = useState<GalleryState>(
    initialState === "new" || initialState === "practicing"
      ? initialState
      : "certified",
  );
  const [dark, setDark] = useState(false);
  const [filters, setFilters] = useState<CaseHistoryFilters>({});
  const history =
    state === "new"
      ? []
      : state === "practicing"
        ? activityHistory.items.slice(0, 2)
        : activityHistory.items;
  const items = history.filter(
    (item) =>
      (!filters.skill || item.skill === filters.skill) &&
      (!filters.outcome || item.outcome === filters.outcome) &&
      (!filters.period ||
        Date.parse("2026-11-15") - Date.parse(item.date) <
          Number(filters.period) * 86_400_000),
  );
  switch (filters.sort) {
    case "date-asc":
      items.reverse();
      break;
    case "accuracy-desc":
      items.sort((a, b) => (b.accuracy ?? -1) - (a.accuracy ?? -1));
      break;
    case "accuracy-asc":
      items.sort((a, b) => (a.accuracy ?? 101) - (b.accuracy ?? 101));
      break;
  }
  const action = (
    <Button
      className="min-h-11"
      variant="outline"
      onClick={() => setState("practicing")}
    >
      Start a case
    </Button>
  );
  return (
    <div
      className={`${dark ? "dark" : ""} min-h-dvh bg-background text-foreground`}
    >
      <header className="flex flex-wrap justify-between gap-2 border-b p-4">
        <div
          className="flex flex-wrap gap-2"
          aria-label="Gallery state"
          role="group"
        >
          {(["new", "practicing", "certified"] as const).map((item) => (
            <Button
              key={item}
              aria-pressed={state === item}
              variant={state === item ? "default" : "outline"}
              className="min-h-11 capitalize"
              onClick={() => setState(item)}
            >
              {item}
            </Button>
          ))}
        </div>
        <Button
          aria-pressed={dark}
          variant="outline"
          className="min-h-11"
          onClick={() => setDark(!dark)}
        >
          {dark ? "Light theme" : "Dark theme"}
        </Button>
      </header>
      <main>
        {screen === "history" ? (
          <HistoryScreen
            result={{ items, hasMore: false }}
            filters={filters}
            onFiltersChange={setFilters}
            page={1}
            onPageChange={() => undefined}
            onStart={action}
          />
        ) : (
          <CertificatesScreen
            result={{
              skills: state === "certified" ? activityCertificates.skills : [],
              caseRecords:
                state === "new" ? [] : activityCertificates.caseRecords,
            }}
            practice={action}
            start={action}
          />
        )}
      </main>
      <Toaster theme={dark ? "dark" : "light"} />
    </div>
  );
}
