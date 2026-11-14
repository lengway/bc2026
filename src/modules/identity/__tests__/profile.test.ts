import { randomUUID } from 'node:crypto';
import { afterAll,beforeAll,expect,it } from 'vitest';
import { createTestDatabase } from '../../../../tests/backend/db-helper';
import { createCatalogService } from '@/modules/catalog';
import { createLlmService,MockProvider } from '@/modules/llm';
import { createProfileService } from '../index';

let state:Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async()=>{state=await createTestDatabase();});
afterAll(async()=>{await state?.cleanup();});
it('stores a validated intake profile and rejects unsupported field packs',async()=>{
  const id=randomUUID();
  await state.db.query('INSERT INTO users(id,email) VALUES($1,$2)',[id,`${id}@example.com`]);
  const details={subfield:'sdr_outbound',years:2,pains:['Discovery questions'],goals:['Qualify opportunities']};
  const llm=createLlmService({defaultModel:'test-model',provider:new MockProvider({'intake.parse':[JSON.stringify(details),JSON.stringify(details),JSON.stringify(details)]}),recordCall:async()=>{}});
  const service=createProfileService({db:state.db,llm,catalog:createCatalogService()});
  expect(await service.getProfile(id)).toBeNull();
  const profile=await service.upsertProfileFromIntake(id,{text:'I am an SDR with two years of experience.',field:'sales',level:'intermediate'});
  expect(profile).toMatchObject({userId:id,...details,level:'intermediate'});
  expect(await service.getProfile(id)).toEqual(profile);
  expect(profile.dailyGoal).toBe(1);
  await service.upsertProfileFromIntake(id,{text:'Account executive',field:'sales',level:'advanced',dailyGoal:3});
  expect(await service.getProfile(id)).toMatchObject({dailyGoal:3,level:'advanced'});
  await service.upsertProfileFromIntake(id,{text:'Account executive',field:'sales',level:'beginner'});
  expect(await service.getProfile(id)).toMatchObject({dailyGoal:3,level:'beginner'});
  await expect(service.upsertProfileFromIntake(id,{text:'Developer',field:'software',level:'beginner'})).rejects.toMatchObject({code:'VALIDATION'});
});
it('does not persist a fabricated subfield after model validation retries',async()=>{
  const id=randomUUID();
  await state.db.query('INSERT INTO users(id,email) VALUES($1,$2)',[id,`${id}@example.com`]);
  const response=JSON.stringify({subfield:'imaginary',years:null,pains:[],goals:[]});
  const llm=createLlmService({defaultModel:'test-model',provider:new MockProvider({'intake.parse':[response,response,response]}),recordCall:async()=>{}});
  const service=createProfileService({db:state.db,llm,catalog:createCatalogService()});
  await expect(service.upsertProfileFromIntake(id,{text:'Help',field:'sales',level:'beginner'})).rejects.toMatchObject({code:'LLM_FAILED'});
  expect(await service.getProfile(id)).toBeNull();
});
