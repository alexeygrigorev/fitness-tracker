---
name: clipboard
description: Get clipboard content (text and images)
---

# Clipboard Commands

## Get Text from Clipboard

**Windows (PowerShell):**
```powershell
Get-Clipboard
```

**Windows (cmd):**
```cmd
powershell -command "Get-Clipboard"
```

**macOS / Linux:**
```bash
pbpaste        # macOS
xclip -o       # Linux (requires xclip)
xsel -o        # Linux (requires xsel)
```

## Get Image from Clipboard

Images are saved to `.tmp/clipboard.png` in the project root.

**Windows:**
```powershell
# Run the project script
powershell -ExecutionPolicy Bypass -File .clipboard.ps1
```

**macOS:**
```bash
pngpaste .tmp/clipboard.png  # Requires: brew install pngpaste
```

## Script (.clipboard.ps1)

Located in project root, saves clipboard images to `.tmp/clipboard.png`:

```powershell
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$img = [System.Windows.Forms.Clipboard]::GetImage()
if ($img) {
    $tmpDir = Join-Path $PSScriptRoot ".tmp"
    if (-not (Test-Path $tmpDir)) {
        New-Item -ItemType Directory -Path $tmpDir | Out-Null
    }
    $path = Join-Path $tmpDir "clipboard.png"
    $img.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $img.Dispose()
    Write-Host "Image saved to: $path"
} else {
    Write-Host "No image in clipboard"
}
```
