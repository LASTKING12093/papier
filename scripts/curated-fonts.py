import urllib.request,hashlib,json,shutil
from pathlib import Path
sources={'Manrope':('manrope','Manrope%5Bwght%5D.ttf'),'NotoSerif':('notoserif','NotoSerif%5Bwdth%2Cwght%5D.ttf'),'NotoSerif-Italic':('notoserif','NotoSerif-Italic%5Bwdth%2Cwght%5D.ttf'),'RobotoMono':('robotomono','RobotoMono%5Bwght%5D.ttf'),'CormorantGaramond':('cormorantgaramond','CormorantGaramond%5Bwght%5D.ttf'),'Caveat':('caveat','Caveat%5Bwght%5D.ttf')}
root=Path('assets/fonts');public=Path('apps/desktop/public/fonts');public.mkdir(parents=True,exist_ok=True)
rows=[]
for name,(family,file) in sources.items():
 url=f'https://raw.githubusercontent.com/google/fonts/main/ofl/{family}/{file}'
 data=urllib.request.urlopen(url,timeout=30).read();(root/f'{name}.ttf').write_bytes(data);(public/f'{name}.ttf').write_bytes(data)
 license=urllib.request.urlopen(f'https://raw.githubusercontent.com/google/fonts/main/ofl/{family}/OFL.txt',timeout=30).read();(root/f'{family}-OFL.txt').write_bytes(license);Path(f'artifacts/licenses/{family}-OFL.txt').write_bytes(license)
 rows.append({'file':f'{name}.ttf','url':url,'sha256':hashlib.sha256(data).hexdigest(),'license':f'{family}-OFL.txt','modified':False})
shutil.copy2(root/'NotoSans-Regular.ttf',public/'NotoSans-Regular.ttf')
(root/'curated-sources.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
print('Downloaded 6 unmodified OFL font files with licenses and hashes.')
