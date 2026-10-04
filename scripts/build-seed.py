import json,pathlib,hashlib
p=pathlib.Path('src/catalog.json');data=json.loads(p.read_text());stat=[]
def q(s):return "'"+str(s).replace("'","''")+"'"
for c in data:
 c['id']=hashlib.sha256((c['kind']+'|'+c['country']+'|'+c['name']).encode()).hexdigest()[:24]
 stat.append('insert into public.bet_catalog(id,kind,country,name,teams,source,updated_at) values('+','.join(q(c[k]) for k in ['id','kind','country','name'])+','+q(json.dumps(c['teams'],ensure_ascii=False))+'::jsonb,'+q(c['source'])+','+q(c['updated_at'])+') on conflict(id) do update set teams=excluded.teams,source=excluded.source,updated_at=excluded.updated_at;')
p.write_text(json.dumps(data,ensure_ascii=False,indent=2))
out=next(pathlib.Path('supabase/migrations').glob('*football_catalog.sql'));out.write_text('\n'.join(stat)+'\n');pathlib.Path('/tmp/bet-seed-batches.json').write_text(json.dumps(['\n'.join(stat[i:i+40]) for i in range(0,len(stat),40)]));print(len(data),sum(len(x['teams']) for x in data),out)
