// Publish a reviewed catalog after the schema exists. Server credentials stay local.
// Usage: node --experimental-strip-types scripts/publish-football-grid-catalog.mjs --env=PATH --expected=VERSION --apply
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {createClient} from '@supabase/supabase-js';
import {candidates,solve} from '../lib/football-grid/engine.ts';
const arg=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
if(arg('env'))process.loadEnvFile(arg('env'));
const catalog=JSON.parse(readFileSync('data/football-grid/catalog.json','utf8'));
if(createHash('sha256').update(JSON.stringify({players:catalog.players,boards:catalog.boards})).digest('hex').slice(0,16)!==catalog.version || catalog.boards.some(b=>!solve(candidates(b,catalog.players))))throw new Error('Invalid catalog');
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
function checked(result){if(result.error)throw new Error(result.error.message);return result.data;}
const active=checked(await client.from('football_grid_catalogs').select('version').eq('active',true).single());
if(active.version===catalog.version){console.log('Catalog already active');process.exit(0);}
if(active.version!==arg('expected'))throw new Error('Active catalog changed; review before publishing');
console.log(JSON.stringify({from:active.version,to:catalog.version,players:catalog.players.length,boards:catalog.boards.length}));
if(!process.argv.includes('--apply'))process.exit(0);
// Stage and verify before switching. Restore the previous catalog if activation fails.
const existing=checked(await client.from('football_grid_catalogs').select('version').eq('version',catalog.version));
if(!existing.length)checked(await client.from('football_grid_catalogs').insert({version:catalog.version,payload:catalog,active:false}));
const staged=checked(await client.from('football_grid_catalogs').select('payload').eq('version',catalog.version).single());
if(!isDeepStrictEqual(staged.payload,catalog))throw new Error('Staged catalog mismatch');
checked(await client.from('football_grid_catalogs').update({active:false}).eq('version',active.version).eq('active',true));
try{checked(await client.from('football_grid_catalogs').update({active:true}).eq('version',catalog.version));}
catch(error){checked(await client.from('football_grid_catalogs').update({active:true}).eq('version',active.version));throw error;}
const confirmed=checked(await client.from('football_grid_catalogs').select('version').eq('active',true).single());
if(confirmed.version!==catalog.version)throw new Error('Activation verification failed');
console.log('Published and verified. Existing rounds retain their original catalog.');
