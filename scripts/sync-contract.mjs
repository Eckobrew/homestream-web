import { readFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/sync-contract.mjs /path/to/unpacked/homestream-api');
const spec = JSON.parse(await readFile(resolve(source, 'openapi.json')));
if (spec.info.version.split('.')[0] !== '1') throw new Error('Unsupported API major version');
for (const file of ['client.ts', 'models.ts', 'paths.d.ts', 'openapi.json']) await copyFile(resolve(source,file), new URL(`../src/api/${file}`, import.meta.url));
console.info(`Updated contract to ${spec.info.version}; review and commit the changes`);
