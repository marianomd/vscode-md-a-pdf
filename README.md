# Beautiful Markdown to PDF

Exports the open `.md` file to PDF, rendering Mermaid diagrams, using the Edge or Chrome you already have installed.

## Features

- Mermaid diagrams are rendered as drawings.
- Code blocks with a language (` ```c `, ` ```json `, ` ```python `...) get syntax highlighting. Blocks without a language stay plain.
- Tables, lists and the rest of regular Markdown.
- One tall page when the file has diagrams (so they are never cut), A4 pages otherwise.

## Usage

With a `.md` file open:

- PDF button in the editor title bar.
- Right-click in the editor or in the explorer, `Beautiful Markdown to PDF: Export`.
- `Ctrl+Shift+P`, `Beautiful Markdown to PDF: Export`.
- Your own shortcut: add this to `keybindings.json`:
  `{ "key": "ctrl+alt+p", "command": "mdAPdf.export", "when": "editorLangId == markdown" }`.

The PDF is written next to the `.md`, with the same name.

## Requirements

- Python 3 with the `markdown` library (`pip install markdown`).
- Microsoft Edge or Google Chrome.
- Internet access (Mermaid, highlight.js and the font are loaded from jsdelivr).

## Settings

| Setting | What it does |
|---|---|
| `mdAPdf.layout` | `auto` (default): one tall page if there are diagrams, A4 otherwise. `tall` or `a4` force one. |
| `mdAPdf.pythonPath` | Python executable, if it is not in the PATH. |
| `mdAPdf.browserPath` | Path to `msedge.exe` or `chrome.exe`, if it is not detected. |
| `mdAPdf.openAfterExport` | Offer to open the PDF when it is done. |

## Package and install

The `.vsix` is not versioned. Build it with the script (it needs neither Node nor vsce):

```
python build_vsix.py
code --install-extension md-a-pdf-1.0.2.vsix --force
```

Then run `Developer: Reload Window`.

## License

MIT
