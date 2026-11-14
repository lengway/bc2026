"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ErrorPanel } from "@/app/_components/error-panel";
import { useSkillPath } from "@/app/_hooks/case-hooks";
import { useCaseHistory } from "@/app/_hooks/owner-activity-hooks";
import { useBillingSummary } from "@/app/_hooks/use-billing-summary";
import { useLearningProfile } from "@/app/_hooks/use-learning-profile";
import {
  practiceCaseHref,
  usePreparePracticeCase,
} from "@/app/_hooks/use-prepare-practice-case";
import { api } from "@/app/_lib/api";
import type { CaseView, GenerateCaseRequest } from "@/contracts";
import {
  DashboardScreen,
  DashboardSkeleton,
  dashboardContainer,
} from "@/screens/dashboard/dashboard-screen";
import { RecentCases } from "@/ui/recent-cases";

function subscribeToHour(onChange: () => void) {
  const timer = window.setInterval(onChange, 60_000);
  window.addEventListener("focus", onChange);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("focus", onChange);
  };
}

const localHour = () => new Date().getHours();
const serverHour = () => null;

function scheduledCase(item: CaseView | null) {
  if (!item) return;
  const kind =
    item.status === "evaluated"
      ? "done"
      : item.status === "evaluating"
        ? "evaluating"
        : "continue";
  return {
    title: item.brief.title,
    subfield: item.subfield,
    href: practiceCaseHref(item),
    kind,
  } as const;
}

export function Dashboard() {
  const router = useRouter();
  const hour = useSyncExternalStore(subscribeToHour, localHour, serverHour);
  const path = useSkillPath();
  const history = useCaseHistory({ limit: 10 });
  const billing = useBillingSummary();
  const profile = useLearningProfile();
  const create = usePreparePracticeCase();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: ({ signal }) => api.session(signal),
    enabled: false,
  });
  const failure = [path, history, billing, profile].find(
    (query) => query.isError,
  );
  if (failure?.error) {
    return (
      <main className={dashboardContainer}>
        <h1 className="text-2xl font-medium">Home</h1>
        <ErrorPanel
          error={failure.error}
          retry={() => void failure.refetch()}
        />
      </main>
    );
  }
  if (!path.data || !history.data || !billing.data || profile.isPending)
    return <DashboardSkeleton />;

  const daily = scheduledCase(path.data.today.daily);
  const weekly = scheduledCase(path.data.today.weekly);
  function start(input: GenerateCaseRequest) {
    if (profile.data) create.prepare(input);
    else router.push("/onboarding");
  }
  function startFromHistory() {
    if (daily) router.push(daily.href);
    else start({ type: "daily" });
  }

  return (
    <DashboardScreen
      path={path.data}
      history={history.data.items}
      recentCases={
        <RecentCases
          cases={history.data.items.slice(0, 5)}
          onStart={startFromHistory}
        />
      }
      plan={billing.data.plan}
      name={session.data?.user.displayName ?? null}
      hour={hour}
      subfield={profile.data?.subfield ?? null}
      daily={daily}
      weekly={weekly}
      pending={create.isPending ? create.variables : undefined}
      onStart={start}
      startError={
        create.isError && (
          <ErrorPanel
            error={create.error}
            retry={() => create.variables && start(create.variables)}
          />
        )
      }
    />
  );
}
