import { dispatch } from '@/app/api/_lib/dispatch';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request):Promise<Response> {
  const response = await dispatch(api=>api.verify(request));
  if (response.status !== 400 && response.status !== 401) return response;
  return new Response(null,{status:303,headers:{Location:'/login?error=expired-link','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
