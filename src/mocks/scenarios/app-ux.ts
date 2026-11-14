import {
  CASES_REQUIRED,
  SKILL_IDS,
  WINDOW_DAYS,
  type SkillPath,
} from "@/contracts";
import { activityHistory } from "./owner-activity";
import { sampleSkillCertificate } from "./skill-certificate";

export function representativeSkillPath(): SkillPath {
  const today = new Date().toISOString().slice(0, 10);
  const date = (days: number) =>
    new Date(
      Date.parse(`${today}T12:00:00.000Z`) - days * 86400000,
    ).toISOString();
  const history = activityHistory.items.map((item, index) => ({
    caseId: item.caseId,
    title: item.title,
    accuracy: item.accuracy,
    date: date(index + 1).slice(0, 10),
  }));

  return {
    skills: SKILL_IDS.map((skill) => ({
      skill,
      level: 2,
      xp: 125,
      nextLevelXp: 200,
    })),
    streak: { current: 3, best: 5 },
    today: { daily: null, weekly: null },
    activity: {
      totalCompleted: history.length,
      completedThisWeek: history.length,
      practicedDates: [date(3), date(2), date(1)].map((value) =>
        value.slice(0, 10),
      ),
      today,
    },
    history,
    series: SKILL_IDS.map((skill) => {
      const certified = skill === sampleSkillCertificate.skill;
      const casesCounted = (
        certified
          ? sampleSkillCertificate.cases
          : skill === "value_articulation"
            ? sampleSkillCertificate.cases.slice(0, 2)
            : []
      ).map((item, index) => ({ ...item, completedAt: date(index + 1) }));
      return {
        skill,
        casesCounted,
        required: CASES_REQUIRED,
        windowDays: WINDOW_DAYS,
        eligible: certified,
        averageAccuracy: casesCounted.length ? (certified ? 86 : 85) : null,
        blockers: certified ? [] : ["insufficient_cases"],
        certificate: certified
          ? {
              slug: sampleSkillCertificate.slug,
              level: sampleSkillCertificate.level,
            }
          : undefined,
      };
    }),
  };
}
