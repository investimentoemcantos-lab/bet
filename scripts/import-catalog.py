import csv,io,json,urllib.request,concurrent.futures,datetime,pathlib
SOURCES=[('Brasil','Brasileirão Série A','new/BRA.csv'),('Argentina','Liga Profesional','new/ARG.csv'),('Inglaterra','Premier League','mmz4281/2627/E0.csv'),('Inglaterra','Championship','mmz4281/2627/E1.csv'),('Espanha','La Liga','mmz4281/2627/SP1.csv'),('Espanha','La Liga 2','mmz4281/2627/SP2.csv'),('Alemanha','Bundesliga','mmz4281/2627/D1.csv'),('Alemanha','2. Bundesliga','mmz4281/2627/D2.csv'),('Itália','Serie A','mmz4281/2627/I1.csv'),('Itália','Serie B','mmz4281/2627/I2.csv'),('França','Ligue 1','mmz4281/2627/F1.csv'),('França','Ligue 2','mmz4281/2627/F2.csv'),('Portugal','Primeira Liga','mmz4281/2627/P1.csv'),('Países Baixos','Eredivisie','mmz4281/2627/N1.csv'),('Bélgica','Pro League','mmz4281/2627/B1.csv'),('Escócia','Premiership','mmz4281/2627/SC0.csv'),('Turquia','Süper Lig','mmz4281/2627/T1.csv'),('Grécia','Super League','mmz4281/2627/G1.csv'),('Estados Unidos','MLS','new/USA.csv'),('Japão','J1 League','new/JPN.csv'),('México','Liga MX','new/MEX.csv'),('China','Super League','new/CHN.csv'),('Dinamarca','Superliga','new/DNK.csv'),('Suécia','Allsvenskan','new/SWE.csv'),('Noruega','Eliteserien','new/NOR.csv'),('Suíça','Super League','new/SWZ.csv'),('Áustria','Bundesliga','new/AUT.csv'),('Polônia','Ekstraklasa','new/POL.csv'),('Romênia','Liga I','new/ROU.csv'),('Rússia','Premier League','new/RUS.csv'),('Finlândia','Veikkausliiga','new/FIN.csv')]
def fetch(item):
 country,league,path=item;url='https://www.football-data.co.uk/'+path
 try:
  raw=urllib.request.urlopen(url,timeout=25).read().decode('utf-8-sig',errors='replace');rows=list(csv.DictReader(io.StringIO(raw)));recent=rows
  if path.startswith('new/'):
   seasons=sorted(set(r.get('Season','') for r in rows));recent=[r for r in rows if r.get('Season') in seasons[-1:]]
  teams=sorted({r.get(k,'').strip() for r in recent for k in ['HomeTeam','AwayTeam','Home','Away']} - {''})
  if len(teams)<2:raise ValueError('Sem equipes')
  return dict(kind='clubs',country=country,name=league,teams=teams,source=url,updated_at=datetime.date.today().isoformat())
 except Exception as e: print('FAILED',country,league,str(e));return None
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool: data=[x for x in pool.map(fetch,SOURCES) if x]
# National-team catalogue from actual international match data; federation region is the first picker.
u='https://raw.githubusercontent.com/martj42/international_results/master/results.csv'
try:
 raw=urllib.request.urlopen(u,timeout=20).read().decode('utf-8-sig');rows=list(csv.DictReader(io.StringIO(raw)));recent=[r for r in rows if r['date']>='2024-01-01'];teams=sorted({r[k] for r in recent for k in ['home_team','away_team']})
 tournaments=sorted({r['tournament'] for r in recent})
 for t in tournaments:
  ts=sorted({r[k] for r in recent if r['tournament']==t for k in ['home_team','away_team']})
  if len(ts)>1:
   hosts=sorted({r['country'] for r in recent if r['tournament']==t})
   for host in hosts:
    hs=sorted({r[k] for r in recent if r['tournament']==t and r['country']==host for k in ['home_team','away_team']})
    data.append(dict(kind='national',country=host,name=t,teams=hs,source=u,updated_at=datetime.date.today().isoformat()))
except Exception as e:print('NATIONAL FAILED',e)
pathlib.Path('src/catalog.json').write_text(json.dumps(data,ensure_ascii=False,indent=2));print('IMPORTED',len(data),'competitions',sum(len(x['teams']) for x in data),'memberships')
