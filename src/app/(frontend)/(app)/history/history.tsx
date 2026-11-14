"use client";

import { useState } from "react";
import { ErrorPanel } from "@/app/_components/error-panel";
import { StartCaseButton } from "@/app/_components/start-case-button";
import { useCaseHistory } from "@/app/_hooks/owner-activity-hooks";
import type { CaseHistoryFilters } from "@/contracts";
import { HistoryScreen } from "@/screens/owner-activity/history-screen";

export function History() {
  const [filters, setFilters] = useState<CaseHistoryFilters>({});
  const [page, setPage] = useState(1);
  const history = useCaseHistory({ ...filters, page });

  return (
    <HistoryScreen
      filters={filters}
      onFiltersChange={(next) => {
        setFilters(next);
        setPage(1);
      }}
      page={page}
      onPageChange={setPage}
      result={history.data}
      loading={history.isPending}
      error={
        history.error && (
          <ErrorPanel
            error={history.error}
            retry={() => void history.refetch()}
          />
        )
      }
      onStart={<StartCaseButton label="Start a case" />}
    />
  );
}
