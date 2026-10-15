"""Arma md-a-pdf-<version>.vsix sin necesitar Node ni vsce (un .vsix es un zip con una estructura fija)."""
import json
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

root = Path(__file__).parent
manifest = json.loads((root / "package.json").read_text(encoding="utf-8"))
name, version, publisher = manifest["name"], manifest["version"], manifest["publisher"]

content_types = """<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension=".json" ContentType="application/json"/>
  <Default Extension=".vsixmanifest" ContentType="text/xml"/>
  <Default Extension=".js" ContentType="application/javascript"/>
  <Default Extension=".py" ContentType="text/x-python"/>
  <Default Extension=".md" ContentType="text/markdown"/>
</Types>
"""

vsixmanifest = f"""<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="{name}" Version="{version}" Publisher="{publisher}" />
    <DisplayName>{escape(manifest["displayName"])}</DisplayName>
    <Description xml:space="preserve">{escape(manifest["description"])}</Description>
    <Categories>Other</Categories>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="{manifest["engines"]["vscode"]}" />
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" />
  </Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true" />
  </Assets>
</PackageManifest>
"""

files = ["package.json", "extension.js", "md-a-pdf.py", "README.md"]
target = root / f"{name}-{version}.vsix"
with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", content_types)
    z.writestr("extension.vsixmanifest", vsixmanifest)
    for f in files:
        z.write(root / f, f"extension/{f}")
print("generado", target)
