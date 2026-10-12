# Extract text (and page images on request) from a PDF with PyMuPDF. usage: python pdf_text.py <pdf> <out.txt> [img_dir pages]
import sys
import fitz

doc = fitz.open(sys.argv[1])
with open(sys.argv[2], 'w', encoding='utf-8') as f:
    for i, page in enumerate(doc):
        f.write('\n===== PAGE %d =====\n' % (i + 1))
        f.write(page.get_text())
print(sys.argv[1].split('\\')[-1], 'pages', len(doc))
if len(sys.argv) > 4:
    import os
    os.makedirs(sys.argv[3], exist_ok=True)
    for p in [int(x) for x in sys.argv[4].split(',')]:
        doc[p - 1].get_pixmap(dpi=90).save(os.path.join(sys.argv[3], 'p%02d.png' % p))
