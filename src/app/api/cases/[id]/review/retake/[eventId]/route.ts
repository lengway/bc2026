import { dispatch } from "@/app/api/_lib/dispatch";
import type { ParamsContext } from "@/app/api/_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(
  request: Request,
  context: ParamsContext,
): Promise<Response> {
  return dispatch((api) => api.retakeStatus(request, context));
}

export function POST(
  request: Request,
  context: ParamsContext,
): Promise<Response> {
  return dispatch((api) => api.retakeSubmit(request, context));
}
