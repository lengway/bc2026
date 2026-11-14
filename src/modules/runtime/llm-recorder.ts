import { z } from 'zod';
import type { Database } from '@/modules/database';
import type { LlmCallRecorder } from '@/modules/llm';

export function createLlmCallRecorder(db: Database): LlmCallRecorder {
  return async (call) => {
    const input = z.json().parse(call.input);
    const output = z.json().nullable().parse(call.output);
    await db.query(`INSERT INTO llm_calls(case_id,prompt_id,prompt_version,model,input,output,ok,latency_ms,tokens_in,tokens_out,error_code,user_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [
      call.caseId,call.promptId,call.promptVersion,call.model,JSON.stringify(input),JSON.stringify(output),
      call.status==='success',call.latencyMs,call.tokensIn,call.tokensOut,call.status==='success'?null:call.status,call.userId??null,
    ]);
  };
}
