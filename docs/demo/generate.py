from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from PIL import Image, ImageDraw
root=Path(__file__).parent
c=canvas.Canvas(str(root/'Northstar - Project brief.pdf'),pagesize=(595,842),invariant=1)
c.setTitle('Northstar / Project brief');c.setAuthor('Papier synthetic demo');c.setSubject('Fictional content created for public product previews')
def text(s,x,y,size=11,color='#29333f',font='Helvetica'):
 c.setFillColor(HexColor(color));c.setFont(font,size);c.drawString(x,y,s)
text('N O R T H S T A R   /   S T U D I O',48,788,9)
text('PROJECT BRIEF',48,718,9,'#62768f')
text('Space for',46,658,48,'#182331');text('better work.',46,603,48,'#182331')
text('A clear direction. A considered document.',48,566,12,'#62768f')
c.setFillColor(HexColor('#e7edf3'));c.rect(48,305,499,224,stroke=0,fill=1)
c.setFillColor(HexColor('#aebfcf'));c.circle(403,415,86,stroke=0,fill=1)
c.setFillColor(HexColor('#253a50'));c.rect(86,336,130,162,stroke=0,fill=1)
c.setFillColor(HexColor('#f9fbfd'));p=c.beginPath();p.moveTo(250,336);p.lineTo(331,490);p.lineTo(415,336);p.close();c.drawPath(p,stroke=0,fill=1)
text('01   /   THE INTENTION',48,270,9,'#62768f')
for i,line in enumerate(['Bring focus to the everyday. This project makes space for clear', 'thinking, useful details and a more deliberate way of working.', 'Every page is a small opportunity to make the next step easier.']):text(line,48,244-i*18,11)
c.setStrokeColor(HexColor('#d6dfe8'));c.line(48,137,547,137)
text('PREPARED BY',48,114,8,'#62768f');text('Alex Morgan',48,95,11)
text('EDITION',380,114,8,'#62768f');text('October 2026',380,95,11)
text('FICTIONAL DEMO / PAPIER',48,43,7,'#62768f');text('01',530,43,9)
c.bookmarkPage('brief');c.addOutlineEntry('Project brief','brief',0);c.showPage()
text('NORTHSTAR / WORKING NOTES',48,788,9)
text('The details matter.',48,701,32)
for i,(a,b) in enumerate([('01  Clarity','Make the next action obvious.'),('02  Craft','Keep only the details that serve the work.'),('03  Confidence','Review, refine, then share.')]):
 y=620-i*98;text(a,48,y,18);text(b,48,y-30,12,'#62768f')
text('REVIEWED BY',48,228,9,'#62768f')
c.acroForm.textfield(name='reviewer',tooltip='Reviewer',x=48,y=180,width=260,height=30,fontSize=12,borderWidth=1)
text('Signature',48,133,9,'#62768f');c.line(48,80,310,80)
text('FICTIONAL DEMO / PAPIER',48,43,7,'#62768f');text('02',530,43,9);c.save()
im=Image.new('RGB',(480,260),'#e7edf3');d=ImageDraw.Draw(im);d.rectangle((35,35,165,225),fill='#253a50');d.ellipse((225,45,405,225),fill='#aebfcf');im.save(root/'northstar-study.png')
