import { dispatch } from '@/app/api/_lib/dispatch';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(request:Request):Promise<Response> { return dispatch(api=>api.getAccount(request)); }
export function PATCH(request:Request):Promise<Response> { return dispatch(api=>api.updateAccount(request)); }
export function DELETE(request:Request):Promise<Response> { return dispatch(api=>api.deleteAccount(request)); }
