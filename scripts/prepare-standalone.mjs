import { cp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const output = process.env.HOMESTREAM_DIST_DIR || '.next';
await mkdir(join(output, 'standalone', output), { recursive: true });
await cp('public', join(output, 'standalone', 'public'), { recursive: true, force: true });
await cp(join(output, 'static'), join(output, 'standalone', output, 'static'), { recursive: true, force: true });
