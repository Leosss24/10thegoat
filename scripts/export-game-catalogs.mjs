/** Read-only public catalog export. Run with --env-file=.env.local. */
import {createClient} from '@supabase/supabase-js';import fs from 'node:fs';
fs.mkdirSync('tmp/content-audit',{recursive:true});
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}});
for(const [table,fields] of [['players','id,display_name,full_name,game_name,photo_url,nationality_country_id,primary_position'],['clubs','id,name,badge_url,is_national_team,is_active,is_game_eligible,domestic_division,country_id'],['countries','*']]){
let rows=[];for(let from=0;;from+=1000){const {data,error}=await db.from(table).select(fields).order('id').range(from,from+999);if(error)throw Error(table+': '+error.message);rows.push(...data);if(data.length<1000)break;}
fs.writeFileSync(`tmp/content-audit/${table}.json`,JSON.stringify(rows,null,2));console.log(table,rows.length);
}
