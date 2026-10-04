from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image, ImageDraw

root = Path(__file__).parent
root.mkdir(parents=True, exist_ok=True)
img = Image.new('RGB', (800, 400), '#e5eade')
d = ImageDraw.Draw(img)
for x, y, r, color in [(170,210,180,'#96ac86'),(455,130,240,'#c2caaa'),(680,320,180,'#728f73')]:
    d.ellipse((x-r,y-r,x+r,y+r), fill=color)
d.rectangle((90,100,710,290), outline='#f6f7ec', width=3)
img.save(root/'landscape.png')
c = canvas.Canvas(str(root/'studio-brief.pdf'), pagesize=(595.28,841.89))
c.setTitle('A considered workspace'); c.setAuthor('PDF Editor test fixture')
def label(t,x,y,size=10,color='#788472',font='Helvetica'):
    c.setFillColor(HexColor(color));c.setFont(font,size);c.drawString(x,y,t)
label('FIELDNOTES     /     DESIGN STUDIO',52,783,9)
label('PROJECT BRIEF',52,719,9,'#3e6c50')
label('A considered',50,665,38,'#29392c','Helvetica')
label('workspace.',50,620,38,'#29392c','Helvetica')
label('A practical guide to doing more with less.',52,581,12)
c.drawImage(str(root/'landscape.png'),52,330,width=491,height=215)
label('01   /   THE INTENTION',52,292,9,'#3e6c50')
for i,line in enumerate(['Great work needs room to breathe. This project brings clarity', 'to everyday documents through thoughtful structure, careful', 'typography, and tools that stay out of the way.']):label(line,52,264-i*19,12,'#44503f')
c.setStrokeColor(HexColor('#d5dccd'));c.line(52,168,543,168)
label('PREPARED FOR',52,145,8);label('The everyday professional',52,126,11,'#334530')
label('VERSION',376,145,8);label('01  /  October 2026',376,126,11,'#334530')
label('FIELDNOTES',52,48,8);label('01',525,48,9)
c.bookmarkPage('brief');c.addOutlineEntry('Project brief','brief',0)
c.showPage()
label('FIELDNOTES     /     DESIGN STUDIO',52,783,9)
label('Space for the details.',52,700,30,'#29392c')
label('02   /   PRINCIPLES',52,653,9,'#3e6c50')
for i,(title,body) in enumerate([('Clarity first','Make the next action obvious.'),('Quiet by design','Keep the document at the center.'),('Built to last','Protect the original. Verify every change.')]):
    y=603-i*92;label(title,52,y,17,'#29392c');label(body,52,y-27,12)
c.acroForm.textfield(name='reviewer',tooltip='Reviewer',x=52,y=180,width=240,height=28,borderWidth=1,fontSize=11)
label('REVIEWER',52,220,9)
c.linkURL('https://example.org', (52,85,210,104), relative=0)
label('View project references',52,91,11,'#3e6c50')
label('02',525,48,9)
c.showPage();label('SECRET_ABC_123',52,730,20,'#222222');label('This content is used to verify permanent removal.',52,690,12);c.save()

# Independent fixture with an embedded subset font and rotated content.
fontpath = root.parent.parent / 'assets/fonts/NotoSans-Regular.ttf'
if fontpath.exists():
    pdfmetrics.registerFont(TTFont('FixtureSubset',str(fontpath)))
    c=canvas.Canvas(str(root/'embedded-font.pdf'),pagesize=(400,500))
    c.setFont('FixtureSubset',17);c.drawString(35,440,'Embedded font: café and ação')
    c.saveState();c.translate(200,250);c.rotate(25);c.drawString(0,0,'Rotated text');c.restoreState();c.save()

c=canvas.Canvas(str(root/'hundred-pages.pdf'),pagesize=(595.28,841.89))
for p in range(100):
    c.setFont('Helvetica',24);c.drawString(52,740,f'Performance fixture - page {p+1}');c.showPage()
c.save()
print('Generated real PDF fixtures.')
