import { expect, it, vi } from "vitest";
import type { SqlExecutor } from "@/modules/database";
import { readSource } from "./repo";

vi.mock("@/modules/simulation", () => ({ SubmittedSnapshot: {} }));

it("excludes private preparation reviews even when the selected move has a score", async () => {
  const db: SqlExecutor = {
    async query() {
      return {
        rowCount: 1,
        rows: [
          {
            type: "prep",
            status: "evaluated",
            accuracy: 85,
            criterion: "discovery",
            snapshot: {},
          },
        ],
      };
    },
  };

  await expect(readSource(db, "owner", "case", "move")).resolves.toBeNull();
});
