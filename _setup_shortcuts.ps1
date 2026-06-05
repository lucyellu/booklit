#requires -version 5
# Sets up terminal-free desktop launchers + folder shortcut for book_app.
# Mechanism per app:  .lnk -> wscript.exe shim.vbs -> powershell (hidden) -> python http.server (hidden) + open browser
Add-Type -AssemblyName System.Drawing

$root      = 'L:\Projects\book_app'
$launchers = Join-Path $root '_launchers'
$desktop   = [Environment]::GetFolderPath('Desktop')
$wscript   = Join-Path $env:WINDIR 'System32\wscript.exe'
New-Item -ItemType Directory -Force -Path $launchers | Out-Null

# ---------------------------------------------------------------------------
# 1. PowerShell launcher (single-instance hidden server + open browser)
# ---------------------------------------------------------------------------
function New-Launcher($file, $dir, $port, $page, $title) {
@"
# Auto-generated launcher for: $title
`$port = $port
`$dir  = '$dir'
`$url  = 'http://localhost:$port/$page'
`$listening = Get-NetTCPConnection -LocalPort `$port -State Listen -ErrorAction SilentlyContinue
if (-not `$listening) {
    Start-Process python -ArgumentList '-m','http.server',"`$port" -WorkingDirectory `$dir -WindowStyle Hidden
    Start-Sleep -Milliseconds 1000
}
Start-Process `$url
"@ | Set-Content -Path $file -Encoding UTF8
}

# ---------------------------------------------------------------------------
# 2. VBScript shim (runs the launcher fully hidden — zero console flash)
# ---------------------------------------------------------------------------
function New-Shim($file, $ps1) {
@"
Set sh = CreateObject("WScript.Shell")
sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$ps1""", 0, False
"@ | Set-Content -Path $file -Encoding ASCII
}

$shelfPs1  = Join-Path $launchers 'launch_shelf.ps1'
$readerPs1 = Join-Path $launchers 'launch_reader.ps1'
$stopPs1   = Join-Path $launchers 'stop_servers.ps1'
New-Launcher $shelfPs1  "$root\cards"                   8087 'bibli_009.html' 'Bibliophile 3D Shelf'
New-Launcher $readerPs1 "$root\reader-bolt\project\dist" 8088 'index.html'     'Bibliophile Reader'

# stop launcher — kills the hidden python http servers on our ports
@"
foreach (`$p in 8087,8088) {
  Get-NetTCPConnection -LocalPort `$p -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id `$_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
"@ | Set-Content -Path $stopPs1 -Encoding UTF8

$shelfVbs  = Join-Path $launchers 'shelf.vbs'
$readerVbs = Join-Path $launchers 'reader.vbs'
$stopVbs   = Join-Path $launchers 'stop.vbs'
New-Shim $shelfVbs  $shelfPs1
New-Shim $readerVbs $readerPs1
New-Shim $stopVbs   $stopPs1

# ---------------------------------------------------------------------------
# 3. Icons  (on-brand: #000 bg, accent rounded book, cream letter)
# ---------------------------------------------------------------------------
function New-Icon($path, $accentHex, $letter) {
    $sz   = 256
    $bmp  = New-Object System.Drawing.Bitmap $sz, $sz
    $g    = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = 'AntiAlias'
    $g.TextRenderingHint = 'AntiAliasGridFit'
    $g.Clear([System.Drawing.Color]::FromArgb(0,0,0))
    $accent = [System.Drawing.ColorTranslator]::FromHtml($accentHex)
    $cream  = [System.Drawing.ColorTranslator]::FromHtml('#08120E')
    $pad = 40; $rw = $sz - 2*$pad; $rh = $sz - 2*$pad; $r = 36
    $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
    $gp.AddArc($pad,$pad,$r,$r,180,90)
    $gp.AddArc($pad+$rw-$r,$pad,$r,$r,270,90)
    $gp.AddArc($pad+$rw-$r,$pad+$rh-$r,$r,$r,0,90)
    $gp.AddArc($pad,$pad+$rh-$r,$r,$r,90,90)
    $gp.CloseFigure()
    $g.FillPath((New-Object System.Drawing.SolidBrush $accent), $gp)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(40,0,0,0))), $pad+18, $pad, 14, $rh)
    $font = New-Object System.Drawing.Font('Segoe UI', 120, [System.Drawing.FontStyle]::Bold)
    $sf   = New-Object System.Drawing.StringFormat; $sf.Alignment='Center'; $sf.LineAlignment='Center'
    $g.DrawString($letter, $font, (New-Object System.Drawing.SolidBrush $cream), (New-Object System.Drawing.RectangleF(0,-6,$sz,$sz)), $sf)
    $hicon = $bmp.GetHicon()
    $icon  = [System.Drawing.Icon]::FromHandle($hicon)
    $fs    = New-Object System.IO.FileStream($path,[System.IO.FileMode]::Create)
    $icon.Save($fs); $fs.Close(); $g.Dispose(); $bmp.Dispose()
}
$icoShelf  = Join-Path $launchers 'shelf.ico'
$icoReader = Join-Path $launchers 'reader.ico'
$icoFolder = Join-Path $launchers 'folder.ico'
$icoStop   = Join-Path $launchers 'stop.ico'
New-Icon $icoShelf  '#45ffbc' 'B'
New-Icon $icoReader '#e3ffa8' 'R'
New-Icon $icoFolder '#a6a6a6' '/'
New-Icon $icoStop   '#ff5a5a' 'X'

# ---------------------------------------------------------------------------
# 4. Desktop shortcuts  (param NOT named $args — that is an automatic var!)
# ---------------------------------------------------------------------------
$ws = New-Object -ComObject WScript.Shell
function New-Shortcut($name, $target, $argline, $workdir, $icon) {
    $lnk = $ws.CreateShortcut((Join-Path $desktop $name))
    $lnk.TargetPath = $target
    if ($argline) { $lnk.Arguments = $argline }
    if ($workdir) { $lnk.WorkingDirectory = $workdir }
    if ($icon)    { $lnk.IconLocation = $icon }
    $lnk.Save()
}
New-Shortcut 'Bibliophile 3D Shelf.lnk' $wscript "`"$shelfVbs`""  "$root\cards"                    $icoShelf
New-Shortcut 'Bibliophile Reader.lnk'   $wscript "`"$readerVbs`"" "$root\reader-bolt\project\dist"  $icoReader
New-Shortcut 'Stop Bibliophile Servers.lnk' $wscript "`"$stopVbs`"" $root                          $icoStop
New-Shortcut 'book_app (folder).lnk' $root '' '' $icoFolder

Write-Output 'Done. Desktop shortcuts:'
Get-ChildItem $desktop -Filter '*.lnk' | Where-Object { $_.Name -match 'Bibliophile|book_app' } | ForEach-Object {
    $l = $ws.CreateShortcut($_.FullName)
    Write-Output ('  ' + $_.Name + '  ->  ' + (Split-Path $l.TargetPath -Leaf) + ' ' + $l.Arguments)
}
