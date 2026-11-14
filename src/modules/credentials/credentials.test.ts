import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createTestDatabase } from '../../../tests/backend/db-helper';
import { reviewedCase } from '../../../tests/backend/review-fixture';
import { createCredentialsService,toPublicFull,toPublicLimited } from './index';

let state:Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async()=>{state=await createTestDatabase();});
afterAll(async()=>{await state?.cleanup();});
describe('public certificates',()=>{
  it('issues one unguessable certificate per case and uses the owner plan for public depth',async()=>{
    const sample=await reviewedCase(state.db);
    let pro=false;
    const owners:string[]=[];
    const service=createCredentialsService({db:state.db,loadSubmission:async()=>sample.snapshot,getReview:async()=>sample.review,canFull:async(owner)=>{owners.push(owner);return pro;}});
    const [first,second]=await Promise.all([service.issueCertificate(sample.snapshot),service.issueCertificate(sample.snapshot)]);
    expect(first).toEqual(second);
    expect(first.slug).toMatch(/^[A-Za-z0-9_-]{10}$/);
    expect(await service.getOwnedSlug(sample.snapshot.case.id,sample.userId)).toBe(first.slug);
    await expect(service.getOwnedSlug(sample.snapshot.case.id,randomUUID())).rejects.toMatchObject({status:404});
    const limited=await service.getBySlug(first.slug);
    expect(limited).not.toHaveProperty('moves');
    expect(limited).not.toHaveProperty('transcript');
    expect(limited.verificationScope).toBe('recorded_simulation');
    pro=true;
    const full=await service.getBySlug(first.slug);
    expect(full).toHaveProperty('evaluation');
    expect(full.accuracy).toBe(limited.accuracy);
    expect(owners).toEqual([sample.userId,sample.userId]);
    const serialized=JSON.stringify(full);
    for(const forbidden of ['processObservations','private-event-value','"hidden"','"realMotive"','"rubric"','"drafts"','tokenHash']) expect(serialized).not.toContain(forbidden);
  });
  it('keeps a revoked case record private across repeated revocation and owner review reads',async()=>{
    const sample=await reviewedCase(state.db);
    const service=createCredentialsService({db:state.db,loadSubmission:async()=>sample.snapshot,getReview:async()=>sample.review,canFull:async()=>false});
    const certificate=await service.issueCertificate(sample.snapshot);
    await expect(service.disablePublicLink(randomUUID(),'case_record',certificate.slug)).rejects.toMatchObject({status:404});
    await expect(service.getBySlug(certificate.slug)).resolves.toMatchObject({slug:certificate.slug});
    await service.disablePublicLink(sample.userId,'case_record',certificate.slug);
    await service.disablePublicLink(sample.userId,'case_record',certificate.slug);
    await expect(service.getBySlug(certificate.slug)).rejects.toMatchObject({status:404});
    expect(await service.getOwnedSlug(sample.caseId,sample.userId)).toBeUndefined();
    expect(await service.issueCertificate(sample.snapshot)).toMatchObject({slug:certificate.slug});
  });
  it('labels guests as demos and strips private inputs from both projection functions',async()=>{
    const sample=await reviewedCase(state.db,{guest:true});
    const service=createCredentialsService({db:state.db,loadSubmission:async()=>sample.snapshot,getReview:async()=>sample.review,canFull:async()=>true});
    const certificate=await service.issueCertificate(sample.snapshot);
    const input={certificate,holderName:'Demo Guest',snapshot:sample.snapshot,review:sample.review};
    const limited=toPublicLimited(input),full=toPublicFull(input);
    expect(limited).toMatchObject({isDemo:true,holderName:'Demo Guest'});
    expect(limited.headline).toContain('Demo');
    expect(full.evaluation).not.toHaveProperty('processObservations');
    expect(JSON.stringify(full.transcript)).not.toContain('private-event-value');
    expect(full.transcript[0]).toHaveProperty('id');
  });
  it('returns not found for an unknown slug',async()=>{
    const service=createCredentialsService({db:state.db,loadSubmission:async()=>null,getReview:async()=>{throw new Error('Must not load');},canFull:async()=>false});
    await expect(service.getBySlug('abcdefghij')).rejects.toMatchObject({code:'NOT_FOUND'});
  });
  it('rejects a projection that mixes another case into the certificate',async()=>{
    const a=await reviewedCase(state.db),b=await reviewedCase(state.db);
    const service=createCredentialsService({db:state.db,loadSubmission:async()=>a.snapshot,getReview:async()=>a.review,canFull:async()=>true});
    const certificate=await service.issueCertificate(a.snapshot);
    expect(()=>toPublicFull({certificate,holderName:'Jordan',snapshot:a.snapshot,review:b.review})).toThrow('do not match');
  });
});
