"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FOCUS_AREAS,
  type DailyGoal,
  type FocusArea,
  type Level,
  type Profile,
} from "@/contracts";
import {
  learningProfileKey,
  useLearningProfile,
} from "@/app/_hooks/use-learning-profile";
import { FormFeedback, TextField } from "@/app/_components/auth-form";
import { ErrorPanel } from "@/app/_components/error-panel";
import { inputClass, labelClass } from "@/app/_components/product";
import { api } from "@/app/_lib/api";
import { Button } from "@/ui/primitives/button";
import { LEVEL_LABEL } from "@/ui/lib/format";
import { Choice, FocusChips, Question } from "../../onboarding/intake-fields";
import {
  EXPERIENCE,
  MAX_FOCUS,
  ROLES,
  SEGMENTS,
  composeIntakeText,
  readIntakeAnswers,
  toggleFocus,
  type IntakeAnswers,
} from "../../onboarding/intake";
import { SettingsLoading, SettingsSection } from "../settings-section";

const levels = ["beginner", "intermediate", "advanced"] as const;
const goals = [1, 2, 3] as const;

export function LearningSettings() {
  const query = useLearningProfile();
  if (query.isPending)
    return <SettingsLoading label="Loading learning preferences…" />;
  if (query.isError)
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  return <LearningForm initialProfile={query.data} />;
}

function LearningForm({ initialProfile }: { initialProfile: Profile | null }) {
  const query = useQueryClient();
  const [answers, setAnswers] = useState(() =>
    readIntakeAnswers(initialProfile),
  );
  const [dailyGoal, setDailyGoal] = useState<DailyGoal>(
    initialProfile?.dailyGoal ?? 1,
  );
  const [savedProfile, setSavedProfile] = useState(initialProfile);
  const save = useMutation({
    mutationFn: () =>
      api.intake({
        text: composeIntakeText(answers),
        field: "sales",
        level: answers.level,
        dailyGoal,
      }),
    onSuccess: (profile) => {
      query.setQueryData(learningProfileKey, profile);
      setSavedProfile(profile);
    },
  });
  function set<K extends keyof IntakeAnswers>(key: K, value: IntakeAnswers[K]) {
    setAnswers((before) => ({ ...before, [key]: value }));
    save.reset();
  }
  function focus(key: "strengths" | "practice", area: FocusArea) {
    set(key, toggleFocus(answers[key], area));
  }
  const savedFocus = readIntakeAnswers(savedProfile).practice.map(
    (area) => FOCUS_AREAS[area].label,
  );
  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <SettingsSection
        title="Practice profile"
        description="These preferences shape your future cases."
      >
        <fieldset disabled={save.isPending} className="grid min-w-0 gap-5">
          <Question title="Role">
            <div className="grid gap-2 lg:grid-cols-3">
              {ROLES.map(({ id, label, detail }) => (
                <Choice
                  key={id}
                  name="role"
                  label={label}
                  detail={detail}
                  checked={answers.role === id}
                  onChange={() => set("role", id)}
                />
              ))}
            </div>
          </Question>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              <span className={labelClass}>Experience</span>
              <select
                className={inputClass}
                value={answers.experience ?? ""}
                onChange={(event) => {
                  const selected = EXPERIENCE.find(
                    (entry) => entry.id === event.target.value,
                  );
                  set("experience", selected?.id ?? null);
                }}
              >
                <option value="">Select experience</option>
                {EXPERIENCE.map(({ id, label }) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              <span className={labelClass}>Case difficulty</span>
              <select
                className={inputClass}
                value={answers.level}
                onChange={(event) => set("level", event.target.value as Level)}
              >
                {levels.map((level) => (
                  <option key={level} value={level}>
                    {LEVEL_LABEL[level]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              <span className={labelClass}>Customer segment</span>
              <select
                className={inputClass}
                value={answers.segment ?? ""}
                onChange={(event) =>
                  set(
                    "segment",
                    SEGMENTS.find(({ id }) => id === event.target.value)?.id ??
                      null,
                  )
                }
              >
                <option value="">Select a segment</option>
                {SEGMENTS.map(({ id, label }) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label="Industry"
              value={answers.industry}
              onChange={(event) => set("industry", event.target.value)}
              maxLength={150}
            />
          </div>
          <Question
            title="What do you want to practice?"
            hint={`Choose up to ${MAX_FOCUS} areas.`}
          >
            <FocusChips
              selected={answers.practice}
              blocked={answers.strengths}
              label="Practice focus"
              onToggle={(area) => focus("practice", area)}
            />
          </Question>
          <Question
            title="What are you already strong at?"
            hint={`Choose up to ${MAX_FOCUS} areas.`}
          >
            <FocusChips
              selected={answers.strengths}
              blocked={answers.practice}
              label="Strengths"
              onToggle={(area) => focus("strengths", area)}
            />
          </Question>
          <label>
            <span className={labelClass}>Practice notes</span>
            <textarea
              className={`${inputClass} min-h-24`}
              value={answers.notes}
              onChange={(event) => set("notes", event.target.value)}
              maxLength={7000}
              rows={3}
            />
          </label>
        </fieldset>
      </SettingsSection>
      <SettingsSection
        title="Daily goal"
        description="Set a practice target. Your plan determines how many cases you can start."
      >
        <fieldset disabled={save.isPending} className="grid grid-cols-3 gap-2">
          <legend className="sr-only">Daily case goal</legend>
          {goals.map((goal) => (
            <Choice
              key={goal}
              name="goal"
              label={goal === 1 ? "1 case" : `${goal} cases`}
              checked={dailyGoal === goal}
              onChange={() => {
                setDailyGoal(goal);
                save.reset();
              }}
            />
          ))}
        </fieldset>
      </SettingsSection>
      <div className="flex flex-wrap items-center gap-4">
        <Button className="min-h-11" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save preferences"}
        </Button>
        <FormFeedback
          error={save.error}
          success={save.isSuccess ? "Learning preferences saved." : undefined}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Your next cases will focus on{" "}
        {savedFocus.length
          ? savedFocus.join(", ").toLowerCase()
          : "a mix of skills for your role"}
        .
      </p>
    </form>
  );
}
