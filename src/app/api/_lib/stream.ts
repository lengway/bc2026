import { Event,LastEventId,EventsQuery } from '@/contracts';
import type { CoreRuntime } from '@/modules/runtime';
import { readSessionCookie } from '@/modules/identity';
import { AppError } from '@/modules/shared';

const streamsByUser = new Map<string,number>();
let activeStreams = 0;
function reserveStream(userId: string) {
  const current = streamsByUser.get(userId) ?? 0;
  if (current>=3 || activeStreams>=128) throw new AppError('RATE_LIMIT',429,'Too many active event streams.');
  streamsByUser.set(userId,current+1); activeStreams++;
  let released = false;
  return () => {
    if (released) return;
    released = true; activeStreams--;
    const remaining = (streamsByUser.get(userId) ?? 1)-1;
    if (remaining>0) streamsByUser.set(userId,remaining); else streamsByUser.delete(userId);
  };
}

export function streamCursor(request:Request):number {
  const previous=request.headers.get('last-event-id');
  return previous!==null?LastEventId.parse(previous):EventsQuery.parse(Object.fromEntries(new URL(request.url).searchParams)).afterSeq;
}
function sleep(ms:number,signal:AbortSignal) {
  return new Promise<void>(resolve=>{
    const done=()=>{clearTimeout(timer);signal.removeEventListener('abort',done);resolve();};
    const timer=setTimeout(done,ms);
    if(signal.aborted) done();else signal.addEventListener('abort',done,{once:true});
  });
}
/** Polling the same ordered journal implements replay and live without a subscription gap. */
export function eventStream(app:CoreRuntime,request:Request,caseId:string,userId:string,cursor:number,pollMs=2000):Response {
  const release = reserveStream(userId);
  const stop=new AbortController();
  const encoder=new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  let pending: Event[] = [],pendingIndex = 0,nextPollAt = 0,nextAccessAt = 0;
  const finish = () => {
    stop.abort();
    request.signal.removeEventListener('abort',finish);
    pending = []; pendingIndex = 0;
    release();
    try { controller?.close(); } catch { /* A cancelled reader is already closed. */ }
  };
  const stream=new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
      request.signal.addEventListener('abort',finish,{once:true});
      if (request.signal.aborted) finish();
    },
    async pull(value) {
      if (stop.signal.aborted) return;
      try {
        if (pendingIndex>=pending.length) {
          const delay = nextPollAt-Date.now();
          if (delay>0) await sleep(delay,stop.signal);
          if (stop.signal.aborted) return;
        }
        // Check access periodically while draining a large replay as well as during live polling.
        if (Date.now()>=nextAccessAt) {
          const session=await app.identity.getSession(readSessionCookie(request.headers.get('cookie')));
          if (!session || session.user.id!==userId) { finish(); return; }
          if (stop.signal.aborted) return;
          await app.caseEngine.getCaseForUser(caseId,userId);
          if (stop.signal.aborted) return;
          nextAccessAt=Date.now()+pollMs;
        }
        if (pendingIndex>=pending.length) {
          const page=await app.events.listPublicByCase(caseId,cursor);
          if (stop.signal.aborted) return;
          pending=page.events.map((event) => Event.parse(event)); pendingIndex=0;
          cursor=Math.max(cursor,page.lastSeq); nextPollAt=Date.now()+pollMs;
        }
        if (pendingIndex<pending.length) {
          const event=pending[pendingIndex++];
          value.enqueue(encoder.encode(`id: ${event.seq}\nevent: case_event\ndata: ${JSON.stringify(event)}\n\n`));
          if (pendingIndex===pending.length) { pending=[];pendingIndex=0; }
        } else value.enqueue(encoder.encode(': heartbeat\n\n'));
      } catch {
        // Ownership/session/database changes end the stream; polling returns the safe error.
        finish();
      } finally { if (stop.signal.aborted) finish(); }
    },
    cancel(){finish();},
  });
  return new Response(stream,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store, no-cache, no-transform','X-Accel-Buffering':'no'}});
}
