import { readdir,unlink } from 'node:fs/promises';
import { join } from 'node:path';

// Next copies loaded .env files separately from file tracing. Secrets belong to
// the runtime environment, not the distributable standalone build directory.
const directory=join(process.cwd(),'.next','standalone');
const entries=await readdir(directory,{withFileTypes:true});
for(const entry of entries) {
  if(entry.isFile()&&(entry.name==='.env'||entry.name.startsWith('.env.'))) {
    await unlink(join(directory,entry.name));
  }
}
