import { z } from 'zod';
import { ApiError } from '@/contracts';
import { AppError, isAppError } from '@/modules/shared';

export type ParamsContext={params:Promise<Record<string,string>>};
export function assertJson(request:Request):void {
  if(request.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase()!=='application/json') {
    throw new AppError('VALIDATION',415,'Content-Type must be application/json.');
  }
}
export function json<T>(schema:z.ZodType<T>,data:unknown,status=200,headers?:HeadersInit):Response {
  const parsed=schema.safeParse(data);
  if(!parsed.success) throw new Error('Invalid server response');
  return Response.json(parsed.data,{status,headers:{'Cache-Control':'no-store',...Object.fromEntries(new Headers(headers))}});
}
export async function guarded(work:()=>Promise<Response>):Promise<Response> {
  try {return await work();}
  catch(error) {
    if(isAppError(error)) return json(ApiError,{error:{code:error.code,message:error.message}},error.status);
    if(error instanceof z.ZodError) return json(ApiError,{error:{code:'VALIDATION',message:'Request data is invalid.'}},400);
    // Do not print provider errors, request bodies, cookies or connection strings.
    console.error('API_REQUEST_FAILED');
    return json(ApiError,{error:{code:'VALIDATION',message:'The request could not be completed.'}},500);
  }
}
export async function readBody(request:Request,maxBytes=65_536):Promise<string> {
  if(!request.body) return '';
  const reader=request.body.getReader();
  const chunks:Uint8Array[]=[];
  let size=0;
  try {
    while(true) {
      const {done,value}=await reader.read();
      if(done) break;
      size+=value.byteLength;
      if(size>maxBytes) {await reader.cancel();throw new AppError('VALIDATION',413,'Request body is too large.');}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const bytes=new Uint8Array(size);
  let offset=0;
  for(const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.length;}
  try {return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
  catch {throw new AppError('VALIDATION',400,'Request body must use valid UTF-8.');}
}
export async function body<T>(request:Request,schema:z.ZodType<T>,maxBytes?:number):Promise<T> {
  assertJson(request);
  const text=await readBody(request,maxBytes);
  let value:unknown;
  try {value=text?JSON.parse(text):{};}
  catch {throw new AppError('VALIDATION',400,'Request body must be valid JSON.');}
  return schema.parse(value);
}
export const query=(request:Request)=>Object.fromEntries(new URL(request.url).searchParams);
