import type { ComponentType } from "react";
import type { CaseView, WorkspaceType } from "@/contracts";
export interface WorkspacePlugin {
  id: WorkspaceType;
  Component: ComponentType<{ caseView: CaseView }>;
}
