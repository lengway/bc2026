/*
 * Design system — public surface.
 * Product components live here; shadcn and Magic UI primitives are in
 * ./primitives and are imported from there directly.
 */

export { AccuracyStat } from "./accuracy-stat";
export { CaseTimer, getCaseTimerState } from "./case-timer";
export { CertificateCard, isFullCertificate } from "./certificate-card";
export { ChatMessage } from "./chat-message";
export { DocViewer } from "./doc-viewer";
export { LabelCounts } from "./label-counts";
export { Meter } from "./meter";
export { MoveDetail } from "./move-detail";
export { MoveLabelBadge } from "./move-label-badge";
export { MOVE_LABEL_META, MOVE_LABEL_ORDER } from "./move-labels";
export { MoveTimeline } from "./move-timeline";
export { OutcomeBadge } from "./outcome-badge";
export { PersonaAvatar, PersonaCard } from "./persona-card";
export { PracticeRecord } from "./practice-record";
export {
  PricingTable,
  PRO_PRICE,
  type BillingPeriod,
  type PlanId,
} from "./pricing-table";
export { Reveal } from "./reveal";
export { SkillProgress } from "./skill-progress";
export { StepChecklist, type ChecklistStep } from "./step-checklist";
export { TrustCurveChart } from "./trust-curve-chart";
export { TwistNotice } from "./twist-notice";
export { TypingIndicator } from "./typing-indicator";
export {
  FIELD_LABEL,
  LEVEL_LABEL,
  firstName,
  formatClock,
  formatDate,
  formatOutcome,
  formatSkill,
  initials,
} from "./lib/format";

export { AppShell, APP_NAVIGATION, type AppBreadcrumb } from "./app-shell";
export { EmptyState, SectionHeader, StatCard } from "./app-summary";
export { HorizontalScroller } from "./horizontal-scroller";
export { SeriesProgress, SKILL_ICONS, SkillCard, skillSeriesStatus } from "./skill-card";
