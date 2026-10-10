import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const walk = dir => fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);
let failures=0, sourceCount=0;
for(const file of walk('src').filter(f=>/\.tsx?$/.test(f))) {
  sourceCount++;
  const source=fs.readFileSync(file,'utf8');
  const result=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,isolatedModules:true}});
  for(const diagnostic of result.diagnostics??[]){if(diagnostic.category===ts.DiagnosticCategory.Error){console.error(file,ts.flattenDiagnosticMessageText(diagnostic.messageText,'\n'));failures++;}}
  const imports=[...source.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g)].map(m=>m[1]);
  for(const spec of imports){const base=path.resolve(path.dirname(file),spec.replace(/\.js$/,''));if(!['','.ts','.tsx','.css','/index.ts','/index.tsx'].some(suffix=>fs.existsSync(base+suffix))){console.error(`Unresolved local import ${spec} in ${file}`);failures++;}}
  if((file.includes('/pages/')||file.includes('/components/'))&&/\.from\s*\(|\.rpc\s*\(/.test(source)){console.error(`Database query leaked into UI: ${file}`);failures++;}
  if(/Math\.random\s*\(|dangerouslySetInnerHTML|localStorage\.(?:getItem|setItem)|sessionStorage\.(?:getItem|setItem)|\beval\s*\(/.test(source)){console.error(`Unexpected random data, unsafe HTML, eval or local fake persistence: ${file}`);failures++;}
}
const sql=fs.readFileSync('supabase/migrations/conflict_detection.sql','utf8');
for(const required of ['ST_DWithin','BEFORE INSERT OR UPDATE OR DELETE','AFTER INSERT OR UPDATE','pg_advisory_xact_lock','SECURITY DEFINER SET search_path=\'\'','civicsync_conflict_pair_unique','p_expected_version','p_request_id','ENABLE ROW LEVEL SECURITY'])if(!sql.includes(required)){console.error(`Required migration safeguard missing: ${required}`);failures++;}
if(/DROP\s+(?:TABLE|SCHEMA)|TRUNCATE\s/i.test(sql)){console.error('Destructive table/schema reset found in deployment migration.');failures++;}
if(failures){console.error(`${failures} source audit failures.`);process.exit(1);}
console.log(`${sourceCount} TypeScript source files passed syntax/local-import/service-boundary checks; required SQL safeguards are present.`);
console.log('This is a source audit, NOT a full dependency-aware typecheck, browser test, or SQL execution.');
