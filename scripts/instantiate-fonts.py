from pathlib import Path
import sys,json,hashlib,shutil
sys.path.insert(0,str(Path('.build-cache/python-fonts').resolve()))
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
root=Path('assets/fonts');source=root/'sources';source.mkdir(exist_ok=True)
manifest=json.loads((root/'curated-sources.json').read_text(encoding='utf-8'))
for entry in manifest:
 target=root/entry['file'];upstream=source/entry['file']
 if not upstream.exists():shutil.copy2(target,upstream)
 f=TTFont(upstream);axes={a.axisTag:(400 if a.axisTag=='wght' else a.defaultValue) for a in f['fvar'].axes}
 static=instantiateVariableFont(f,axes,inplace=False,updateFontNames=True);static.save(target);shutil.copy2(target,Path('apps/desktop/public/fonts')/entry['file'])
 entry['upstream_sha256']=hashlib.sha256(upstream.read_bytes()).hexdigest();entry['sha256']=hashlib.sha256(target.read_bytes()).hexdigest();entry['modified']=True;entry['modification']='Static regular instance generated with fontTools 4.66.1';entry['axes']=axes
 print(entry['file'],axes,target.stat().st_size)
(root/'curated-sources.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
note='Papier curated fonts: static regular instances generated from upstream OFL variable fonts using fontTools 4.66.1. Weight 400; width 100 where applicable. No glyph designs changed. Original copyright notices and OFL licenses are retained. Source URLs and original/distributed SHA-256 hashes are recorded in assets/fonts/curated-sources.json.\n'
(root/'INSTANCE-NOTES.txt').write_text(note,encoding='utf-8');Path('artifacts/licenses/Papier-font-instance-notes.txt').write_text(note,encoding='utf-8')
