import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const TEST_USER = '00000000-0000-4000-8000-000000000001';
export const OTHER_USER = '00000000-0000-4000-8000-000000000002';
export async function createTestDatabase() {
  const modulePath = process.env.GRID_PGLITE_MODULE;
  const { PGlite } = modulePath ? await import(pathToFileURL(resolve(modulePath)).href) : await import('../../tmp/grid-test/node_modules/@electric-sql/pglite/dist/index.js');
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to authenticated,anon;
    insert into auth.users values ('${TEST_USER}'),('${OTHER_USER}');`);
  const dashboard=readFileSync('supabase/migrations/20260903_012_user_dashboard.sql','utf8');
  await db.exec(dashboard.slice(dashboard.indexOf('create table if not exists public.user_game_stats')));
  await db.exec('grant select on public.user_game_stats to authenticated;');
  await db.exec(readFileSync('supabase/migrations/20260908_014_football_grid.sql','utf8'));
  await db.exec(readFileSync('supabase/seeds/football_grid_catalog.sql','utf8'));
  // Each call uses the actual migration under the same role and identity boundary.
  // The transaction wrapper also keeps concurrent simulated browser requests isolated.
  let pending=Promise.resolve();
  function asUser(sql,params=[],user=TEST_USER){
    const call=pending.then(()=>db.transaction(async tx=>{
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user??'']);
      await tx.exec('set local role authenticated');
      return tx.query(sql,params);
    }));
    pending=call.catch(()=>{});return call;
  }
  async function rpc(args={},user=TEST_USER){
    const r=await asUser('select public.football_grid_play($1,$2,$3,$4,$5) as value',[args.p_action??'state',args.p_difficulty??'easy',args.p_round??null,args.p_cell??null,args.p_player??null],user);
    return r.rows[0].value;
  }
  return {db,rpc,asUser};
}
