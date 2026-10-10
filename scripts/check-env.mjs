import fs from 'node:fs';
const values = {...process.env};
// Vite loads these names in production. Existing process values have priority.
for (const file of ['.env.production.local','.env.local','.env.production','.env']) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file,'utf8').split(/\r?\n/)) {
    const m=line.match(/^\s*(?:export\s+)?([A-Za-z_][\w]*)\s*=\s*(.*?)\s*$/);
    if (m && values[m[1]] == null) values[m[1]]=m[2].replace(/^(["'])(.*)\1$/,'$2');
  }
}
const error = message => {console.error(message);process.exit(1);};
for(const [name,value] of Object.entries(values)) {
  if(!name.startsWith('VITE_') || !value) continue;
  if (/SERVICE_ROLE|SECRET|PRIVATE_KEY|DATABASE_URL|PASSWORD/.test(name) || value.startsWith('sb_secret_')) error(`Unsafe browser environment variable: ${name}. Remove it and rotate any exposed credential.`);
  const parts=value.split('.');
  if(parts.length===3){try{const payload=JSON.parse(Buffer.from(parts[1],'base64url'));if(payload.role==='service_role')error(`A service-role key is present in ${name}. It must never be bundled.`);}catch{}}
}
const url=values.VITE_SUPABASE_URL, key=values.VITE_SUPABASE_PUBLISHABLE_KEY || values.VITE_SUPABASE_ANON_KEY;
if(!url || !key){if(process.argv.includes('--allow-unconfigured'))console.log('No live backend configuration: the build will show the explicit setup screen.');else error('Missing VITE_SUPABASE_URL or browser-safe Supabase key. Copy .env.example to .env.local.');}
else console.log('Browser credential exposure checks passed. A successful API request is still required to verify the backend.');
