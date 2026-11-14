import { CertificateSlug,type CertificateResponse,type ReviewResponse } from '@/contracts';
import type { Database,SqlExecutor } from '@/modules/database';
import { AppError,systemClock,type Clock } from '@/modules/shared';
import type { SubmittedSnapshot } from '@/modules/simulation';
import { findBySlug,issue } from './repo';
import { toPublicFull,toPublicLimited } from './projection';

export interface CredentialsDeps {
  db:Database;loadSubmission:(caseId:string)=>Promise<SubmittedSnapshot|null>;
  getReview:(caseId:string,userId:string)=>Promise<ReviewResponse>;
  canFull:(ownerId:string)=>Promise<boolean>;now?:Clock;
}
export function createCredentialsService({db,loadSubmission,getReview,canFull,now=systemClock}:CredentialsDeps) {
  return {
    issueCertificate:(snapshot:SubmittedSnapshot)=>db.transaction(tx=>issue(tx,snapshot,now())),
    issueCertificateWithExecutor:(tx:SqlExecutor,snapshot:SubmittedSnapshot)=>issue(tx,snapshot,now()),
    async getBySlug(slug:string):Promise<CertificateResponse> {
      if(!CertificateSlug.safeParse(slug).success) throw new AppError('NOT_FOUND',404,'Certificate not found.');
      const found=await findBySlug(db,slug);
      if(!found) throw new AppError('NOT_FOUND',404,'Certificate not found.');
      const snapshot=await loadSubmission(found.certificate.caseId);
      if(!snapshot||snapshot.case.userId!==found.certificate.userId) throw new AppError('NOT_FOUND',404,'Certificate not found.');
      const review=await getReview(found.certificate.caseId,found.certificate.userId);
      const holderName=snapshot.case.isGuest?'Demo Guest':found.holderName??'Skills participant';
      const input={certificate:found.certificate,holderName,snapshot,review};
      return await canFull(found.certificate.userId)?toPublicFull(input):toPublicLimited(input);
    },
  };
}
export type CredentialsService=ReturnType<typeof createCredentialsService>;
