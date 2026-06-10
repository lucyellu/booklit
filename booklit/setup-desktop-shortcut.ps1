Add-Type -AssemblyName System.Drawing

$Dir       = $PSScriptRoot
$IconPath  = Join-Path $Dir 'booklit.ico'
$BatPath   = Join-Path $Dir 'launch-booklit.bat'
$LinkName  = 'Booklit.lnk'
$LinkPath  = Join-Path ([Environment]::GetFolderPath('Desktop')) $LinkName

# -- Draw 256x256 icon --
$size = 256
$bmp  = New-Object System.Drawing.Bitmap $size, $size
$g    = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode     = 'AntiAlias'
$g.TextRenderingHint = 'AntiAlias'

# Rounded-rect background - dark navy (#0a0e27)
$bgRect = New-Object System.Drawing.Rectangle 4, 4, ($size - 8), ($size - 8)
$path   = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = 28
$path.AddArc($bgRect.X,            $bgRect.Y,             $r*2, $r*2, 180, 90)
$path.AddArc($bgRect.Right - $r*2, $bgRect.Y,             $r*2, $r*2, 270, 90)
$path.AddArc($bgRect.Right - $r*2, $bgRect.Bottom - $r*2, $r*2, $r*2, 0,   90)
$path.AddArc($bgRect.X,            $bgRect.Bottom - $r*2, $r*2, $r*2, 90,  90)
$path.CloseFigure()

$bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 10, 14, 39))
$g.FillPath($bgBrush, $path)

# Border - ember orange (#F15A22)
$borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 241, 90, 34)), 5
$g.DrawPath($borderPen, $path)

# Draw an open book shape
$bookPen   = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 241, 90, 34)), 4
$bookBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(60, 241, 90, 34))

# Left page
$leftPage = New-Object System.Drawing.Drawing2D.GraphicsPath
$leftPage.AddLine(128, 80, 50, 90)
$leftPage.AddLine(50, 90, 45, 185)
$leftPage.AddLine(45, 185, 128, 175)
$leftPage.CloseFigure()
$g.FillPath($bookBrush, $leftPage)
$g.DrawPath($bookPen, $leftPage)

# Right page
$rightPage = New-Object System.Drawing.Drawing2D.GraphicsPath
$rightPage.AddLine(128, 80, 206, 90)
$rightPage.AddLine(206, 90, 211, 185)
$rightPage.AddLine(211, 185, 128, 175)
$rightPage.CloseFigure()
$g.FillPath($bookBrush, $rightPage)
$g.DrawPath($bookPen, $rightPage)

# Spine line
$g.DrawLine($bookPen, 128, 78, 128, 177)

# Text lines on left page (small orange lines)
$linePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(140, 241, 90, 34)), 2
$g.DrawLine($linePen, 68, 110, 115, 108)
$g.DrawLine($linePen, 70, 122, 117, 120)
$g.DrawLine($linePen, 72, 134, 119, 132)
$g.DrawLine($linePen, 74, 146, 121, 144)

# Text lines on right page
$g.DrawLine($linePen, 141, 108, 192, 110)
$g.DrawLine($linePen, 139, 120, 190, 122)
$g.DrawLine($linePen, 137, 132, 188, 134)
$g.DrawLine($linePen, 135, 144, 186, 146)

# "B" letter below book
$font = New-Object System.Drawing.Font ('Segoe UI', 36, [System.Drawing.FontStyle]::Bold)
$textBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 240, 235, 227))
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment     = 'Center'
$sf.LineAlignment = 'Center'
$textRect = New-Object System.Drawing.RectangleF 0, 185, $size, 55
$g.DrawString('B', $font, $textBrush, $textRect, $sf)

$g.Dispose()

# -- Wrap PNG into ICO --
$ms  = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$png = $ms.ToArray(); $ms.Close(); $bmp.Dispose()

if (Test-Path $IconPath) { Remove-Item $IconPath -Force }
$fs = New-Object System.IO.FileStream $IconPath, 'Create'
$bw = New-Object System.IO.BinaryWriter $fs
$bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]1)
$bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([byte]0)
$bw.Write([uint16]1); $bw.Write([uint16]32)
$bw.Write([uint32]$png.Length); $bw.Write([uint32]22)
$bw.Write($png); $bw.Close(); $fs.Close()

# -- Build .lnk --
$ws  = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut($LinkPath)
$lnk.TargetPath       = $BatPath
$lnk.WorkingDirectory = $Dir
$lnk.IconLocation     = "$IconPath,0"
$lnk.Description      = 'Launch Booklit - unified book reader and 3D library'
$lnk.WindowStyle      = 7
$lnk.Save()

Write-Host "[ok] Shortcut placed on Desktop: $LinkName"
