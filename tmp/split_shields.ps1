Add-Type -AssemblyName System.Drawing

$inputPath = "C:\Users\imai\.gemini\antigravity\brain\3d881c25-bc9b-420b-a61e-0eb4f3fe8d38\media__1774530814471.png"
$outputDir = "C:\Users\imai\workspace\dcgpj\public\assets\images\icon\shield"

if (-not (Test-Path $inputPath)) {
    Write-Error "Input file not found: $inputPath"
    exit 1
}

$img = [System.Drawing.Image]::FromFile($inputPath)
$width = $img.Width
$height = $img.Height

$partWidth = [int][Math]::Floor($width / 3)
$names = @("intact.png", "back.png", "broken.png")

for ($i = 0; $i -lt 3; $i++) {
    $srcRect = New-Object System.Drawing.Rectangle ([int]($i * $partWidth)), 0, $partWidth, $height
    $target = New-Object System.Drawing.Bitmap $partWidth, $height
    $graphics = [System.Drawing.Graphics]::FromImage($target)
    
    $destRect = New-Object System.Drawing.Rectangle 0, 0, $partWidth, $height
    $graphics.DrawImage($img, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    
    $outputPath = Join-Path $outputDir $names[$i]
    $target.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $graphics.Dispose()
    $target.Dispose()
    Write-Host "Saved: $outputPath"
}

$img.Dispose()
