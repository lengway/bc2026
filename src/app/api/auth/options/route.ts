import { dispatch } from '@/app/api/_lib/dispatch';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET():Promise<Response> {
  return dispatch(api=>api.authOptions());
}
