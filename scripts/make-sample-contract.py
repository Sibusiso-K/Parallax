"""Generate a clearly fictional, legible contract fixture. No model or network."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import textwrap
ROOT = Path(__file__).resolve().parents[1]
im = Image.new('RGB', (1240,1754), 'white')
draw = ImageDraw.Draw(im)
font_path = 'C:/Windows/Fonts/calibri.ttf'
font = ImageFont.truetype(font_path, 30)
heading = ImageFont.truetype(font_path, 46)
draw.text((95,95), 'SAMPLE CATERING AGREEMENT', fill='black', font=heading)
y=195
paragraphs = [
'Between Bright Plate Catering (Pty) Ltd (the Caterer) and Example Facilities Group (fictional) (the Client). Both parties in this sample are fictional.',
'1. Start date and service',
'The agreement starts on 1 December 2026. The Caterer will prepare and deliver weekday lunches to the Client at an agreed delivery address. Menus and dietary requirements will be agreed in writing.',
'2. Monthly fee',
'The Client will pay the Caterer R120,000 per month for the agreed catering service. The Caterer will issue an invoice at the end of each service month.',
'3. Payment terms',
'Payment is due within 90 calendar days of the date of each invoice.',
'4. Late payment',
'An unpaid amount will attract a late penalty of 2% per month after its due date until payment is received.',
'5. Changes and termination',
'Changes to the service must be agreed in writing. Either party may terminate this agreement by giving 30 calendar days of written notice. Charges for services already provided remain payable.',
'Signed for the Caterer: ____________________',
'Signed for the Client: _____________________',
'Date: ____________________',
]
for paragraph in paragraphs:
    for line in textwrap.wrap(paragraph, width=78):
        draw.text((95,y),line,font=font,fill='black');y+=41
    y+=24
assert y < 1600, y
draw.text((95,1655),'SAMPLE DOCUMENT. Fictional parties. Not legal advice.',font=font,fill='black')
out=ROOT/'web/public/samples/sample-contract.png'
out.parent.mkdir(parents=True,exist_ok=True)
im.save(out,optimize=True)
print(f'{out.name}: {im.size}, {out.stat().st_size} bytes')
