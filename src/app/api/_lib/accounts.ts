import { z } from 'zod';
import {
  AccountResponse, ChangeEmailRequest, ChangePasswordRequest, DeleteAccountRequest, ForgotPasswordRequest,
  LoginRequest, LoginResponse, LogoutResponse, MagicLinkResponse, RegisterRequest, ResetPasswordRequest,
  UpdateAccountRequest, VerifyEmailRequest,
} from '@/contracts';
import { consumeRateLimit, hashToken, safeRedirect, sessionCookie } from '@/modules/identity';
import type { CoreRuntime } from '@/modules/runtime';
import { body, json } from './http';

interface AuthHttp {
  csrf(request:Request):void;
  respond(request:Request,work:()=>Promise<Response>):Promise<Response>;
  user(request:Request):Promise<unknown>;
  token(request:Request):string|null;
  requestKey(request:Request):string;
  secure:boolean;
}
export function createAccountApi(app:CoreRuntime, {csrf,respond,user,token,requestKey,secure}:AuthHttp) {
  const cleared=()=>({'Set-Cookie':sessionCookie('',new Date(0),secure,app.now())});
  const proofLimit=(request:Request)=>consumeRateLimit(app.db,`proof:ip:${hashToken(requestKey(request))}`,30,900_000,app.now());
  return {
    register:(request:Request)=>respond(request,async()=>{
      csrf(request);const input=await body(request,RegisterRequest);
      return json(MagicLinkResponse,await app.identity.register(input,requestKey(request)),202);
    }),
    resendVerification:(request:Request)=>respond(request,async()=>{
      csrf(request);await body(request,z.strictObject({}));await user(request);
      return json(MagicLinkResponse,await app.identity.resendVerification(token(request),requestKey(request)),202);
    }),
    login:(request:Request)=>respond(request,async()=>{
      csrf(request);const input=await body(request,LoginRequest);
      const result=await app.identity.login(input,requestKey(request),token(request));
      return json(LoginResponse,{session:result.session,next:safeRedirect(input.next)},200,{'Set-Cookie':sessionCookie(result.token,new Date(result.session.expiresAt),secure,app.now())});
    }),
    verifyEmail:(request:Request)=>respond(request,async()=>{
      csrf(request);const input=await body(request,VerifyEmailRequest);await proofLimit(request);
      const result=await app.identity.verifyEmail(input.token);
      return json(LogoutResponse,result,200,{'Set-Cookie':sessionCookie(result.token,new Date(result.session.expiresAt),secure,app.now())});
    }),
    forgotPassword:(request:Request)=>respond(request,async()=>{
      csrf(request);const input=await body(request,ForgotPasswordRequest);
      return json(MagicLinkResponse,await app.identity.forgotPassword(input.email,requestKey(request)),202);
    }),
    resetPassword:(request:Request)=>respond(request,async()=>{
      csrf(request);const input=await body(request,ResetPasswordRequest);await proofLimit(request);
      return json(LogoutResponse,await app.identity.resetPassword(input,token(request)));
    }),
    getAccount:(request:Request)=>respond(request,async()=>{
      await user(request);return json(AccountResponse,await app.identity.getAccount(token(request)));
    }),
    updateAccount:(request:Request)=>respond(request,async()=>{
      csrf(request);const input=await body(request,UpdateAccountRequest);await user(request);
      return json(AccountResponse,await app.identity.updateAccount(token(request),input));
    }),
    changePassword:(request:Request)=>respond(request,async()=>{
      csrf(request);const input=await body(request,ChangePasswordRequest);await user(request);
      return json(LogoutResponse,await app.identity.changePassword(token(request),input));
    }),
    changeEmail:(request:Request)=>respond(request,async()=>{
      csrf(request);const input=await body(request,ChangeEmailRequest);await user(request);
      return json(MagicLinkResponse,await app.identity.changeEmail(token(request),input),202);
    }),
    logoutAll:(request:Request)=>respond(request,async()=>{
      csrf(request);await body(request,z.strictObject({}));
      return json(LogoutResponse,await app.identity.logoutAll(token(request)),200,cleared());
    }),
    deleteAccount:(request:Request)=>respond(request,async()=>{
      csrf(request);const input=await body(request,DeleteAccountRequest);
      return json(LogoutResponse,await app.identity.deleteAccount(token(request),input),200,cleared());
    }),
  };
}
