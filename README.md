# Markdown a PDF (Mermaid)

Exporta el `.md` abierto a PDF, dibujando los diagramas Mermaid, con el Edge o Chrome ya instalado.

## Uso

Con un `.md` abierto:

- Botón del PDF en la barra de título del editor.
- Clic derecho en el editor o en el explorador, `Markdown a PDF: Exportar`.
- `Ctrl+Shift+P`, `Markdown a PDF: Exportar`.
- Atajo propio: en `keybindings.json` agregar
  `{ "key": "ctrl+alt+p", "command": "mdAPdf.export", "when": "editorLangId == markdown" }`.

El PDF queda al lado del `.md`, con el mismo nombre.

## Requisitos

- Python 3 con la librería `markdown` (`pip install markdown`).
- Microsoft Edge o Google Chrome.
- Internet (Mermaid y la fuente se cargan desde jsdelivr).

## Ajustes

| Ajuste | Para qué |
|---|---|
| `mdAPdf.layout` | `auto` (default): una página alta si hay diagramas, A4 si no. `tall` o `a4` fuerzan una. |
| `mdAPdf.pythonPath` | Ejecutable de Python si no está en el PATH. |
| `mdAPdf.browserPath` | Ruta a `msedge.exe` o `chrome.exe` si no lo detecta. |
| `mdAPdf.openAfterExport` | Ofrecer abrir el PDF al terminar. |

## Empaquetar e instalar

El `.vsix` no se versiona: se arma con el script (no necesita Node ni vsce).

```
python build_vsix.py
code --install-extension md-a-pdf-1.0.0.vsix --force
```

Después, `Developer: Reload Window`.

## Licencia

MIT
