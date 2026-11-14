import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import { Evaluation } from '@/contracts';
import { createTestDatabase } from '../../../tests/backend/db-helper';
import { reviewedCase } from '../../../tests/backend/review-fixture';
import { insufficientReview } from '../../../src/mocks/fixtures';
import { createProgressService,levelForXp } from './index';

let state:Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async()=>{state=await createTestDatabase();});
afterAll(async()=>{await state?.cleanup();});
const now=()=>new Date('2026-11-14T23:00:00Z');
const service=()=>createProgressService({db:state.db,now,getCaseForUser:async()=>null,loadSubmission:async()=>null});

describe('practice progress',()=>{
  it('awards weekly XP once under concurrency and respects level thresholds',async()=>{
    const sample=await reviewedCase(state.db,{type:'weekly'});
    const progress=service();
    await Promise.all([1,2,3].map(()=>state.db.transaction(tx=>progress.awardWithExecutor(tx,sample.snapshot,sample.review.evaluation))));
    const path=await progress.getSkillPath(sample.userId);
    expect(path.skills.length).toBe(sample.review.evaluation.skills.length);
    for(const skill of path.skills) expect(skill).toMatchObject({xp:225,level:2,nextLevelXp:250});
    expect(path.streak).toEqual({current:1,best:1});
    expect(levelForXp(1400)).toEqual({level:6,nextLevelXp:2000});
    expect(levelForXp(2000)).toEqual({level:7,nextLevelXp:2700});
  });
  it('uses submission dates in the user timezone and handles out-of-order completion',async()=>{
    const newest=await reviewedCase(state.db,{timezone:'America/Los_Angeles',submittedAt:'2026-11-15T00:30:00Z'});
    const previous=await reviewedCase(state.db,{userId:newest.userId,submittedAt:'2026-11-14T00:30:00Z'});
    const progress=service();
    await state.db.transaction(tx=>progress.awardWithExecutor(tx,newest.snapshot,newest.review.evaluation));
    await state.db.transaction(tx=>progress.awardWithExecutor(tx,previous.snapshot,previous.review.evaluation));
    const path=await progress.getSkillPath(newest.userId);
    expect(path.streak).toEqual({current:2,best:2});
    expect(path.history.map(item=>item.date)).toEqual(['2026-11-14','2026-11-13']);
    const later=createProgressService({db:state.db,now:()=>new Date('2026-11-17T12:00:00Z'),getCaseForUser:async()=>null,loadSubmission:async()=>null});
    expect((await later.getSkillPath(newest.userId)).streak).toEqual({current:0,best:2});
  });
  it('does not award XP for an unscored case; observed practice can still preserve a streak',async()=>{
    const sample=await reviewedCase(state.db);
    const evaluation=Evaluation.parse({...insufficientReview.evaluation,caseId:sample.caseId});
    const progress=service();
    await state.db.transaction(tx=>progress.awardWithExecutor(tx,sample.snapshot,evaluation));
    const path=await progress.getSkillPath(sample.userId);
    expect(path.skills).toEqual([]);
    expect(path.streak).toEqual({current:1,best:1});
    const empty=await reviewedCase(state.db);
    const snapshot={...empty.snapshot,events:[]};
    await state.db.transaction(tx=>progress.awardWithExecutor(tx,snapshot,{...evaluation,caseId:empty.caseId}));
    expect((await progress.getSkillPath(empty.userId)).streak).toEqual({current:0,best:0});
  });
});
