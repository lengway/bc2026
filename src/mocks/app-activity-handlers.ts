import { http, HttpResponse } from "msw";
import {
  CaseHistoryFilters,
  OwnedCertificateFilters,
  type HistoryCase,
  type OwnedCertificates,
} from "@/contracts";

function invalid() {
  return HttpResponse.json(
    { error: { code: "VALIDATION", message: "Request data is invalid." } },
    { status: 400 },
  );
}

export function createActivityHandlers({
  cases,
  certificates,
}: {
  cases: () => readonly HistoryCase[];
  certificates: () => OwnedCertificates;
}) {
  return [
    http.get("*/api/me/history", ({ request }) => {
      const input = CaseHistoryFilters.safeParse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
      if (!input.success) return invalid();
      const { skill, outcome, period, sort, limit, page } = input.data;
      const minimumDate = period
        ? new Date(Date.now() - (Number(period) - 1) * 86_400_000)
            .toISOString()
            .slice(0, 10)
        : null;
      const results = cases().filter(
        (item) =>
          (!skill || item.skill === skill) &&
          (!outcome || item.outcome === outcome) &&
          (!minimumDate || item.date >= minimumDate),
      );
      results.sort((a, b) => {
        if (sort === "date-asc") return a.date.localeCompare(b.date);
        if (sort === "date-desc") return b.date.localeCompare(a.date);
        if (a.accuracy === null) return Number(b.accuracy !== null);
        if (b.accuracy === null) return -1;
        const delta = a.accuracy - b.accuracy;
        return (
          (sort === "accuracy-asc" ? delta : -delta) ||
          b.date.localeCompare(a.date)
        );
      });
      const offset = (page - 1) * limit;
      return HttpResponse.json({
        items: results.slice(offset, offset + limit),
        hasMore: results.length > offset + limit,
      });
    }),
    http.get("*/api/me/certificates", ({ request }) => {
      const input = OwnedCertificateFilters.safeParse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
      if (!input.success) return invalid();
      const { skill } = input.data;
      const result = certificates();
      return HttpResponse.json(
        skill
          ? {
              skills: result.skills.filter((item) => item.skill === skill),
              caseRecords: result.caseRecords.filter(
                (item) => item.skill === skill,
              ),
            }
          : result,
      );
    }),
  ];
}
