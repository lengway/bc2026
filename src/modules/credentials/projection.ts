import { AiUseSkillSummary,CertificateFull,CertificateLimited,CertificateTranscriptEvent,PublicEvaluation,ScoringSummary,type ReviewResponse,type CaseRecordLimited } from '@/contracts';
import type { SubmittedSnapshot } from '@/modules/simulation';
import type { CertificateRecord } from './repo';

export interface CertificateProjection {
  certificate:CertificateRecord;holderName:string;snapshot:SubmittedSnapshot;review:ReviewResponse;
  skillCertificate?:CaseRecordLimited['skillCertificate'];
}
export function toPublicLimited({certificate,holderName,snapshot,review,skillCertificate}:CertificateProjection):CertificateLimited {
  if(certificate.caseId!==snapshot.case.id||certificate.userId!==snapshot.case.userId||review.evaluation.caseId!==snapshot.case.id) {
    throw new Error('Certificate, snapshot and evaluation do not match');
  }
  return CertificateLimited.parse({
    slug:certificate.slug,holderName,skill:certificate.skill,field:snapshot.case.field,level:snapshot.case.level,
    issuedAt:certificate.issuedAt,caseTitle:snapshot.case.brief.title,accuracy:review.evaluation.accuracy,
    outcome:review.evaluation.outcome,headline:`${snapshot.case.isDemo?'Demo: ':''}${certificate.skill} simulation — ${review.evaluation.outcome}`,
    verified:true,verificationScope:'recorded_simulation',isDemo:snapshot.case.isDemo,
    skillCertificate,assistance:review.evaluation.assistance,aiUseSkillSummary:AiUseSkillSummary.parse(review.evaluation.aiUseSkill),
    scoringSummary:ScoringSummary.parse(review.evaluation.scoreAudit),
  });
}
export function toPublicFull(input:CertificateProjection):CertificateFull {
  return CertificateFull.parse({
    ...toPublicLimited(input),evaluation:PublicEvaluation.parse(input.review.evaluation),moves:input.review.moves,
    personas:input.snapshot.case.personas.map(persona=>persona.public),
    transcript:input.snapshot.events.filter(event=>event.isPublic).map(event=>CertificateTranscriptEvent.parse(event)),
  });
}
