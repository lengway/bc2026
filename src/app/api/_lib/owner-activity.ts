import {
  CaseHistoryFilters,
  CaseHistoryPage,
  OwnedCertificateFilters,
  OwnedCertificates,
  type SessionView,
} from "@/contracts";
import {
  readCaseHistory,
  readOwnedCertificates,
} from "@/modules/owner-activity";
import type { CoreRuntime } from "@/modules/runtime";
import { json, query } from "./http";

export function createOwnerActivityApi(
  app: CoreRuntime,
  {
    respond,
    user,
  }: {
    respond: (
      request: Request,
      work: () => Promise<Response>,
    ) => Promise<Response>;
    user: (request: Request) => Promise<NonNullable<SessionView>["user"]>;
  },
) {
  return {
    history: (request: Request) =>
      respond(request, async () => {
        const owner = await user(request);
        const filters = CaseHistoryFilters.parse(query(request));
        return json(
          CaseHistoryPage,
          await readCaseHistory(
            app.db,
            app.catalog,
            owner.id,
            filters,
            app.now(),
          ),
        );
      }),
    ownedCertificates: (request: Request) =>
      respond(request, async () => {
        const owner = await user(request);
        const { skill } = OwnedCertificateFilters.parse(query(request));
        return json(
          OwnedCertificates,
          await readOwnedCertificates(app.db, app.catalog, owner.id, skill),
        );
      }),
  };
}
