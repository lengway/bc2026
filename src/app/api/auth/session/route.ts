import { dispatch } from '@/app/api/_lib/dispatch';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(request:Request):Promise<Response> {
  return dispatch(api=>api.session(request));
}
