import type { SkillProgressSeries } from "@/contracts";

export function orderSkillSeries(series: readonly SkillProgressSeries[]) {
  // A full series with a blocker needs a replacement case.
  const priority = (item: SkillProgressSeries) =>
    item.casesCounted.length === item.required ? 0.5 : item.casesCounted.length;
  return [...series].sort(
    (a, b) =>
      Number(Boolean(a.certificate)) - Number(Boolean(b.certificate)) ||
      priority(b) - priority(a),
  );
}

function mean(scores: readonly (number | null)[]) {
  const available = scores.filter((value) => value !== null);
  return available.length
    ? available.reduce((sum, value) => sum + value, 0) / available.length
    : null;
}

export function accuracyStats(cases: readonly { accuracy: number | null }[]) {
  const recent = cases.slice(0, 5).map(({ accuracy }) => accuracy);
  const average = mean(recent);
  const previous =
    cases.length >= 10
      ? mean(cases.slice(5, 10).map(({ accuracy }) => accuracy))
      : null;
  return {
    average,
    delta:
      average === null || previous === null
        ? null
        : Math.round(average - previous),
    points: recent.reverse(),
  };
}

const dayLabel = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function practiceDays(today: string, practicedDates: readonly string[]) {
  const end = new Date(`${today}T00:00:00Z`);
  const days = new Set(practicedDates);
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - 13 + index);
    return {
      label: dayLabel.format(date),
      practiced: days.has(date.toISOString().slice(0, 10)),
    };
  });
}

export function greetingAt(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
