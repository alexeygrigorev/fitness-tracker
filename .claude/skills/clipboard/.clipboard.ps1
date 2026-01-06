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
