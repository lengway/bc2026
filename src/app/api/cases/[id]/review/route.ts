import { dispatch } from '@/app/api/_lib/dispatch';
import type { ParamsContext } from '@/app/api/_lib/http';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(request:Request,context:ParamsContext):Promise<Response> {
  return dispatch(api=>api.review(request,context));
}
