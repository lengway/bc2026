import { afterEach,describe,expect,it } from 'vitest';
import type { CoreRuntime } from '@/modules/runtime';
import { eventStream } from '../../src/app/api/_lib/stream';

describe('bounded SSE resources', () => {
  const responses: Response[] = [];
  afterEach(async () => {
    for (const response of responses.splice(0)) await response.body?.cancel();
  });
  function fixture(userId = 'owner') {
    let polls = 0;
    const app = {
      identity: { async getSession() { return { user: { id: userId } }; } },
      caseEngine: { async getCaseForUser() { return { id: 'case',status: 'in_progress' }; } },
      events: { async listPublicByCase() { polls++; return { events: [],lastSeq: 0 }; } },
    } as unknown as CoreRuntime;
    return { app,polls: () => polls };
  }
  function open(userId: string, f: ReturnType<typeof fixture>, signal?: AbortSignal) {
    const response = eventStream(f.app,new Request('https://skills.example/stream',{ signal }), 'case',userId,0,1);
    responses.push(response);
    return response;
  }
  it('stops database polling while the consumer has no demand', async () => {
    const f = fixture();
    open('owner',f);
    await new Promise((resolve) => setTimeout(resolve,75));
    expect(f.polls()).toBe(1);
  });
  it('limits one user to three streams and releases slots on abort and cancel', async () => {
    const f = fixture(),abort = new AbortController();
    const first = open('owner',f,abort.signal);
    const second = open('owner',f),third = open('owner',f);
    expect(() => open('owner',f)).toThrow(expect.objectContaining({ code: 'RATE_LIMIT',status: 429 }));
    abort.abort();
    const replacement = open('owner',f);
    await second.body!.cancel();
    const next = open('owner',f);
    await Promise.all([first,third,replacement,next].map((response) => response.body!.cancel()));
  });
  it('limits the process to 128 streams and recovers capacity after cancellation', async () => {
    for (let index=0;index<128;index++) open(`owner-${index}`,fixture(`owner-${index}`));
    expect(() => open('extra',fixture('extra'))).toThrow(expect.objectContaining({ code: 'RATE_LIMIT',status: 429 }));
    await responses[0].body!.cancel();
    expect(open('extra',fixture('extra')).status).toBe(200);
  });
});
