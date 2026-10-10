import assert from 'node:assert/strict';
import pg from 'pg';
const {Client}=pg;
const url=process.env.CIVICSYNC_TEST_DATABASE_URL;
if(!url || !new URL(url).pathname.slice(1).startsWith('civicsync_test_'))throw new Error('Concurrency tests require a disposable civicsync_test_* database.');
const a=new Client({connectionString:url}),b=new Client({connectionString:url}),read=new Client({connectionString:url});
const first='90000000-0000-4000-8000-000000000001', second='90000000-0000-4000-8000-000000000002';
try{
  await Promise.all([a.connect(),b.connect(),read.connect()]);
  await a.query('BEGIN');
  await a.query(`INSERT INTO public.projects(id,title,road_name,location,work_type,department_id,start_date,end_date,status,latitude,longitude)
    VALUES($1,'Concurrent water works','Concurrency road','Test zone','water','10000000-0000-4000-8000-000000000001','2035-01-01','2035-01-10','planned',30,80)`,[first]);
  // A is definitely inserted and uncommitted. B must block at the BEFORE STATEMENT lock.
  let bSettled=false;
  const pending=b.query(`INSERT INTO public.projects(id,title,road_name,location,work_type,department_id,start_date,end_date,status,latitude,longitude)
    VALUES($1,'Concurrent telecom work','Concurrency road','Test zone','telecom','10000000-0000-4000-8000-000000000002','2035-01-05','2035-01-15','planned',30.0001,80)`,[second]).finally(()=>{bSettled=true;});
  await new Promise(resolve=>setTimeout(resolve,200));
  assert.equal(bSettled,false,'Writer B must wait until writer A commits.');
  await a.query('COMMIT');
  await pending;
  const result=await read.query('SELECT count(*)::int AS n FROM public.project_conflicts WHERE project_a_id=$1 AND project_b_id=$2 AND status=\'open\'',[first,second]);
  assert.equal(result.rows[0].n,1,'Concurrent inserts must leave exactly one persisted conflict.');
  console.log('PASS: real concurrent transactions, writer serialization and one canonical conflict.');
  // A material update while a reviewer waits must invalidate the review version.
  const conflict=(await read.query('SELECT * FROM public.project_conflicts WHERE project_a_id=$1 AND project_b_id=$2',[first,second])).rows[0];
  await a.query('BEGIN'); await a.query("UPDATE public.projects SET end_date='2035-01-11' WHERE id=$1",[first]);
  await b.query("SET ROLE authenticated");
  await b.query("SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',false)");
  const stale=b.query('SELECT public.resolve_conflict($1,$2,$3,$4,$5)',[conflict.id,'resolved','Both departments agreed to a coordinated work sequence.',conflict.version,'90000000-0000-4000-8000-000000000099']).then(()=>{throw new Error('Stale review unexpectedly succeeded.');},e=>{assert.equal(e.code,'40001');});
  await new Promise(resolve=>setTimeout(resolve,100)); await a.query('COMMIT'); await stale;
  console.log('PASS: a concurrent material change rejects a stale review.');
}finally{try{await a.query('ROLLBACK');}catch{} await Promise.allSettled([a.end(),b.end(),read.end()]);}
