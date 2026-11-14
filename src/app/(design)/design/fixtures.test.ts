import { describe, expect, it } from "vitest";
import {
  CaseDoc,
  CertificateFull,
  CertificateLimited,
  Evaluation,
  MoveReview,
  PersonaPublic,
  SkillPath,
  parseDocContent,
} from "@/contracts";
import {
  certificateFull,
  certificateLimited,
  docs,
  evaluation,
  moves,
  persona,
  skillPath,
} from "./fixtures";

const WEIGHTS = { brilliant: 100, best: 100, good: 80, inaccuracy: 50, mistake: 20, blunder: 0 };

describe("gallery fixtures", () => {
  it("match the contracts", () => {
    expect(() => PersonaPublic.parse(persona)).not.toThrow();
    expect(() => MoveReview.array().parse(moves)).not.toThrow();
    expect(() => Evaluation.parse(evaluation)).not.toThrow();
    expect(() => CertificateLimited.parse(certificateLimited)).not.toThrow();
    expect(() => CertificateFull.parse(certificateFull)).not.toThrow();
    expect(() => CaseDoc.array().parse(docs)).not.toThrow();
    expect(() => SkillPath.parse(skillPath)).not.toThrow();
  });

  it("have document content that matches each kind", () => {
    for (const doc of docs) {
      expect(parseDocContent(doc), doc.id).not.toBeNull();
    }
  });

  it("are internally consistent with the scoring rules", () => {
    const average = moves.reduce((sum, move) => sum + WEIGHTS[move.label], 0) / moves.length;
    expect(Math.round(average)).toBe(evaluation.accuracy);

    for (const [label, count] of Object.entries(evaluation.labelCounts)) {
      expect(moves.filter((move) => move.label === label)).toHaveLength(count);
    }
  });

  it("records the failed AI pricing check shown in the sample review", () => {
    expect(evaluation.trapResult).toBe("missed");
    expect(evaluation.aiUseSkill).toMatchObject({ score: 0, assessedChecks: 1, applicableChecks: 1 });
    expect(evaluation.aiUseSkill.checks[0]).toMatchObject({
      status: "failed",
      evidence: expect.arrayContaining([
        expect.objectContaining({ source: "case_doc", sourceId: "doc-note" }),
        expect.objectContaining({ source: "user_event", sourceId: moves[5].eventId }),
      ]),
    });
  });
});
