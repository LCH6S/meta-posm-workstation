"""Build the directly-openable HTML. No build step is needed to use index.html."""
from pathlib import Path
from base64 import b64encode

ROOT = Path(__file__).resolve().parent
css = (ROOT / 'styles.css').read_text()
jsx = (ROOT / 'app.jsx').read_text()
ui = (ROOT / 'meta-ui.jsx').read_text()
scripts = ['react.js', 'react-dom.js', 'babel.js', 'qrcode.js', 'jsbarcode.js', 'jspdf.js']
tags = '\n'.join(f'<script src="assets/vendor/{p}"></script>' for p in scripts)
(ROOT / 'index.html').write_text(f'''<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#F7F8FA"><title>Meta POS · 电子发票</title><link rel="icon" href="data:,"><style>{css}</style></head><body><div id="root"></div>
{tags}
<script src="assets/vendor/font-data.js"></script><script src="core.js?v=20261116-manual-independent"></script>
<script type="text/babel">{ui}</script><script type="text/babel">{jsx}</script></body></html>''')

font_path = ROOT / 'assets/vendor/invoice-cjk.ttf'
font_script = ROOT / 'assets/vendor/font-data.js'
if font_path.exists():
    font_script.write_text('window.INVOICE_FONT="' + b64encode(font_path.read_bytes()).decode() + '";')
print(ROOT / 'index.html')
