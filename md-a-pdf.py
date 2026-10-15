#!/usr/bin/env python3
"""Convierte un .md a PDF usando el Edge/Chrome ya instalado (sin Docker ni Node).

Uso:
    python docs/tools/md-a-pdf.py archivo.md [salida.pdf] [--a4 | --tall]

- Los bloques ```mermaid se dibujan (Mermaid se carga desde jsdelivr: requiere internet).
- Por defecto (auto): si el .md tiene diagramas genera UNA sola página del alto del contenido, para que
  no se corten; si no tiene, hojas A4. --a4 o --tall fuerzan una u otra.
- El front-matter YAML (--- ... ---) del .md se ignora.
Requiere: Python 3, `pip install markdown` y Microsoft Edge o Google Chrome.
"""
import html
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    import markdown
except ImportError:
    sys.exit("Falta la librería markdown. Instalala con: pip install markdown")

MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@12/dist/mermaid.esm.min.mjs"
FONT_CSS_URLS = [
    "https://cdn.jsdelivr.net/npm/@fontsource/open-sans@5/400.css",
    "https://cdn.jsdelivr.net/npm/@fontsource/open-sans@5/700.css",
]
PAGE_WIDTH_PX = 1200

CSS = """
  body { font-family: 'Open Sans', Arial, Helvetica, sans-serif; color: #222; line-height: 1.45; font-size: 14px; }
  h1 { font-size: 24px; margin: 0 0 6px 0; color: #222; }
  h1 + p { margin: 0 0 18px 0; color: #555; font-size: 13px; }
  h2 { font-size: 17px; margin: 26px 0 8px 0; color: #222; }
  h3 { font-size: 15px; color: #222; }
  pre.mermaid { text-align: center; background: white; margin: 12px 0; }
  pre.mermaid svg { width: 100%; height: auto; }
  pre:not(.mermaid) { background: #f5f5f5; padding: 10px; font-size: 12px; white-space: pre-wrap; word-break: break-word; }
  code { background: #f0f0f0; padding: 1px 4px; border-radius: 3px; font-size: 90%; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 13px; }
  th, td { border: 1px solid #bbb; padding: 6px 10px; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; }
  blockquote { border-left: 4px solid #ccc; margin-left: 0; padding-left: 12px; color: #555; }
"""


def find_browser():
    candidates = [
        os.environ.get("BROWSER_PATH", ""),
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ]
    for name in ("msedge", "google-chrome", "chromium", "chromium-browser", "chrome"):
        found = shutil.which(name)
        if found:
            candidates.append(found)
    for path in candidates:
        if path and Path(path).exists():
            return path
    sys.exit("No encontré Edge ni Chrome. Definí la variable de entorno BROWSER_PATH con la ruta al ejecutable.")


def md_to_html_body(text):
    text = re.sub(r"\A---\r?\n.*?\r?\n---\r?\n", "", text, flags=re.S)  # front-matter

    diagrams = []

    def stash(match):
        diagrams.append(match.group(1).strip("\r\n"))
        return f"\n\n@@MERMAID{len(diagrams) - 1}@@\n\n"

    text = re.sub(r"```mermaid\r?\n(.*?)```", stash, text, flags=re.S)
    body = markdown.markdown(text, extensions=["tables", "fenced_code", "sane_lists"])
    for i, source in enumerate(diagrams):
        block = f'<pre class="mermaid">\n{html.escape(source, quote=False)}\n</pre>'
        body = body.replace(f"<p>@@MERMAID{i}@@</p>", block)
    return body


def build_html(body, a4):
    if a4 is None:
        a4 = 'class="mermaid"' not in body  # sin diagramas: hojas A4; con diagramas: una sola página alta
    if a4:
        page_css = "@page { size: A4; margin: 12mm; } pre.mermaid { break-inside: avoid; }"
        body_css = "body { margin: 0; }"
        page_js = ""
    else:
        page_css = ""
        body_css = f"body {{ width: {PAGE_WIDTH_PX}px; margin: 0; padding: 28px 36px; box-sizing: border-box; }}"
        # Tras dibujar los diagramas se fija el alto de la hoja al alto del contenido
        page_js = """
  const h = Math.ceil(document.documentElement.scrollHeight) + 2;
  const style = document.createElement('style');
  style.textContent = '@page { size: %dpx ' + h + 'px; margin: 0; }';
  document.head.appendChild(style);
""" % PAGE_WIDTH_PX
    fonts = "".join(f'<link rel="stylesheet" href="{url}">' for url in FONT_CSS_URLS)
    return f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">{fonts}
<style>{CSS}{body_css}{page_css}</style></head><body>
{body}
<script type="module">
  import mermaid from '{MERMAID_URL}';
  mermaid.initialize({{ startOnLoad: false, fontFamily: "'Open Sans', sans-serif" }});
  await document.fonts.ready;
  await mermaid.run({{ querySelector: 'pre.mermaid' }});
{page_js}
</script>
</body></html>
"""


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    a4 = True if "--a4" in sys.argv else False if "--tall" in sys.argv else None
    if not args:
        sys.exit(__doc__)

    source = Path(args[0]).resolve()
    target = Path(args[1]).resolve() if len(args) > 1 else source.with_suffix(".pdf")
    browser = find_browser()

    with tempfile.TemporaryDirectory() as tmp:
        page = Path(tmp) / "doc.html"
        page.write_text(build_html(md_to_html_body(source.read_text(encoding="utf-8")), a4), encoding="utf-8")
        profile = Path(tmp) / "profile"  # perfil propio: si Edge ya está abierto, no se cuelga ni se mezcla
        cmd = [
            browser, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
            f"--user-data-dir={profile}", "--virtual-time-budget=20000",
            f"--print-to-pdf={target}", page.as_uri(),
        ]
        subprocess.run(cmd, check=True, timeout=120, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    if not target.exists():
        sys.exit("El navegador no generó el PDF.")
    print(f"PDF generado: {target}")


if __name__ == "__main__":
    main()
