import {spawnSync} from 'node:child_process';
const url=process.env.CIVICSYNC_TEST_DATABASE_URL;
if(!url){console.error('Set CIVICSYNC_TEST_DATABASE_URL to a DISPOSABLE PostgreSQL/PostGIS database named civicsync_test_*. No SQL was run.');process.exit(1);}
let name;try{name=new URL(url).pathname.slice(1);}catch{console.error('Use a PostgreSQL connection URL.');process.exit(1);}
if(!name.startsWith('civicsync_test_')){console.error('Refusing to initialize any database not named civicsync_test_*.');process.exit(1);}
for(const file of ['supabase/tests/fixture.sql','supabase/migrations/000_extend_person2_enums.sql','supabase/migrations/conflict_detection.sql','supabase/migrations/conflict_detection.sql','supabase/tests/conflict_tests.sql']){
  console.log(`Running ${file}`);
  const result=spawnSync('psql',['-X','-v','ON_ERROR_STOP=1','-f',file],{stdio:'inherit',env:{...process.env,PGDATABASE:url}});
  if(result.error||result.status!==0){console.error('SQL test stopped:',result.error?.message??`exit ${result.status}`);process.exit(1);}
}
await import('./test-concurrency.mjs');
