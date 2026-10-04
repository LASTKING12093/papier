"""Build an offline outline atlas from unmodified OFL fonts. No runtime Python dependency."""
from pathlib import Path
import sys, urllib.request, json, math, hashlib
sys.path.insert(0,str(Path('.build-cache/python').resolve()))
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
root=Path('vendor/signature-fonts');root.mkdir(parents=True,exist_ok=True)
fonts=[('Allura','allura','Allura-Regular.ttf'),('Mr De Haviland','mrdehaviland','MrDeHaviland-Regular.ttf'),('Nothing You Could Do','nothingyoucoulddo','NothingYouCouldDo.ttf'),('Sacramento','sacramento','Sacramento-Regular.ttf'),('Qwigley','qwigley','Qwigley-Regular.ttf')]
class OutlinePen(BasePen):
 def __init__(self,gs,scale):super().__init__(gs);self.scale=scale;self.paths=[];self.line=[]
 def p(self,p):return [round(p[0]*self.scale,3),round(-p[1]*self.scale,3)]
 def _moveTo(self,p):self.line=[self.p(p)];self.paths.append(self.line)
 def _lineTo(self,p):self.line.append(self.p(p))
 def _curveToOne(self,a,b,c):
  d=self._getCurrentPoint();length=sum(math.dist(x,y) for x,y in [(d,a),(a,b),(b,c)])*self.scale;n=max(4,min(60,math.ceil(length/1.7)))
  for i in range(1,n+1):
   t=i/n;u=1-t;self.line.append(self.p([u**3*d[k]+3*u*u*t*a[k]+3*u*t*t*b[k]+t**3*c[k] for k in [0,1]]))
 def _qCurveToOne(self,a,b):
  d=self._getCurrentPoint();self._curveToOne(tuple(d[k]+(a[k]-d[k])*2/3 for k in [0,1]),tuple(b[k]+(a[k]-b[k])*2/3 for k in [0,1]),b)
 def _closePath(self):pass
 def _endPath(self):pass
atlas={};manifest=[]
for name,folder,file in fonts:
 dest=root/folder;dest.mkdir(exist_ok=True)
 for remote in [file,'OFL.txt']:
  target=dest/remote
  if not target.exists():urllib.request.urlretrieve(f'https://raw.githubusercontent.com/google/fonts/main/ofl/{folder}/{remote}',target)
 font=TTFont(dest/file);gs=font.getGlyphSet();scale=100/font['head'].unitsPerEm;cmap=font.getBestCmap();glyphs={}
 for code in list(range(32,127))+list(range(160,256)):
  if code not in cmap:continue
  key=cmap[code];pen=OutlinePen(gs,scale);gs[key].draw(pen);glyphs[chr(code)]={'advance':round(font['hmtx'][key][0]*scale,3),'paths':pen.paths}
 atlas[{'Allura':'Papier Script A','Mr De Haviland':'Papier Script B','Nothing You Could Do':'Papier Script C','Sacramento':'Papier Script D','Qwigley':'Papier Script E'}[name]]=glyphs;manifest.append({'name':name,'source':f'https://github.com/google/fonts/tree/main/ofl/{folder}','license':'SIL Open Font License 1.1','sha256':hashlib.sha256((dest/file).read_bytes()).hexdigest()})
Path('apps/desktop/src/signature-atlas.json').write_text(json.dumps(atlas,separators=(',',':')),encoding='utf-8')
(root/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('Generated',len(atlas),'families;',Path('apps/desktop/src/signature-atlas.json').stat().st_size,'bytes')
