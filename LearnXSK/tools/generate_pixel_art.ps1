Add-Type -AssemblyName System.Drawing

$artDir = "C:\Users\anmol\OneDrive\Desktop\LearnXSK\Game\Assets\LearnXSK\Art"
if (!(Test-Path $artDir)) {
    New-Item -ItemType Directory -Path $artDir -Force | Out-Null
}

function Create-IsometricGrassTile {
    param([string]$path)
    $w = 64
    $h = 48
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    
    # Transparent background
    for ($x = 0; $x -lt $w; $x++) {
        for ($y = 0; $y -lt $h; $y++) {
            $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        }
    }
    
    # Top isometric diamond: center (32, 16), rx = 32, ry = 16
    for ($y = 0; $y -lt 32; $y++) {
        $dx = [math]::Round(31 * (1 - [math]::Abs($y - 15) / 16))
        $minX = 32 - $dx
        $maxX = 32 + $dx
        for ($x = $minX; $x -le $maxX; $x++) {
            if ($x -ge 0 -and $x -lt $w) {
                # Grass shades
                $shade = (($x * 7 + $y * 13) % 4)
                $col = switch ($shade) {
                    0 { [System.Drawing.Color]::FromArgb(255, 76, 175, 80) }
                    1 { [System.Drawing.Color]::FromArgb(255, 67, 160, 71) }
                    2 { [System.Drawing.Color]::FromArgb(255, 92, 184, 92) }
                    3 { [System.Drawing.Color]::FromArgb(255, 56, 142, 60) }
                }
                # Highlights on top edge
                if ($y -eq [math]::Abs([math]::Round(($x - 32) * 0.5))) {
                    $col = [System.Drawing.Color]::FromArgb(255, 129, 199, 132)
                }
                $bmp.SetPixel($x, $y, $col)
            }
        }
    }
    
    # Front-left face (y from diamond lower-left to bottom, x: 0 to 31)
    for ($x = 0; $x -lt 32; $x++) {
        $topY = [math]::Round(16 + ($x * 0.5))
        for ($y = $topY; $y -lt ($topY + 16); $y++) {
            if ($y -lt $h) {
                $col = if (($x + $y) % 5 -eq 0) { [System.Drawing.Color]::FromArgb(255, 109, 76, 65) }
                       elseif (($x * 3 + $y) % 7 -eq 0) { [System.Drawing.Color]::FromArgb(255, 141, 110, 99) }
                       else { [System.Drawing.Color]::FromArgb(255, 93, 64, 55) }
                $bmp.SetPixel($x, $y, $col)
            }
        }
    }
    
    # Front-right face (x: 32 to 63)
    for ($x = 32; $x -lt $w; $x++) {
        $topY = [math]::Round(31 - (($x - 32) * 0.5))
        for ($y = $topY; $y -lt ($topY + 16); $y++) {
            if ($y -lt $h) {
                $col = if (($x + $y) % 4 -eq 0) { [System.Drawing.Color]::FromArgb(255, 78, 52, 46) }
                       else { [System.Drawing.Color]::FromArgb(255, 62, 39, 35) }
                $bmp.SetPixel($x, $y, $col)
            }
        }
    }
    
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

function Create-IsometricTechTile {
    param([string]$path)
    $w = 64
    $h = 48
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    
    for ($y = 0; $y -lt 32; $y++) {
        $dx = [math]::Round(31 * (1 - [math]::Abs($y - 15) / 16))
        $minX = 32 - $dx
        $maxX = 32 + $dx
        for ($x = $minX; $x -le $maxX; $x++) {
            if ($x -ge 0 -and $x -lt $w) {
                $isGrid = ($x % 8 -eq 0) -or ($y % 4 -eq 0)
                $col = if ($isGrid) { [System.Drawing.Color]::FromArgb(255, 0, 210, 255) }
                       else { [System.Drawing.Color]::FromArgb(255, 26, 35, 48) }
                if ($x -eq 32 -and $y -eq 16) { $col = [System.Drawing.Color]::FromArgb(255, 255, 255, 255) }
                $bmp.SetPixel($x, $y, $col)
            }
        }
    }
    
    for ($x = 0; $x -lt 32; $x++) {
        $topY = [math]::Round(16 + ($x * 0.5))
        for ($y = $topY; $y -lt ($topY + 16); $y++) {
            if ($y -lt $h) {
                $col = [System.Drawing.Color]::FromArgb(255, 17, 24, 34)
                if ($y -eq $topY + 15) { $col = [System.Drawing.Color]::FromArgb(255, 0, 150, 200) }
                $bmp.SetPixel($x, $y, $col)
            }
        }
    }
    for ($x = 32; $x -lt $w; $x++) {
        $topY = [math]::Round(31 - (($x - 32) * 0.5))
        for ($y = $topY; $y -lt ($topY + 16); $y++) {
            if ($y -lt $h) {
                $col = [System.Drawing.Color]::FromArgb(255, 11, 15, 22)
                if ($y -eq $topY + 15) { $col = [System.Drawing.Color]::FromArgb(255, 0, 100, 150) }
                $bmp.SetPixel($x, $y, $col)
            }
        }
    }
    
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

function Create-MissionBoardIcon {
    param([string]$path, [string]$theme, [System.Drawing.Color]$accentColor, [System.Drawing.Color]$glowColor)
    $w = 64
    $h = 64
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    
    # Clear transparent
    for ($x = 0; $x -lt $w; $x++) {
        for ($y = 0; $y -lt $h; $y++) {
            $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0,0,0,0))
        }
    }
    
    # Isometric pedestal base at bottom (y 42 to 60)
    for ($y = 44; $y -lt 60; $y++) {
        $dx = [math]::Round(22 * (1 - [math]::Abs($y - 52) / 8))
        if ($dx -gt 0) {
            for ($x = (32 - $dx); $x -le (32 + $dx); $x++) {
                if ($x -ge 0 -and $x -lt $w) {
                    $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, 30, 41, 59))
                }
            }
        }
    }
    
    # Mission Board Monitor Frame (x 10 to 53, y 8 to 44)
    for ($x = 10; $x -le 53; $x++) {
        for ($y = 8; $y -le 44; $y++) {
            $isBorder = ($x -le 12 -or $x -ge 51 -or $y -le 10 -or $y -ge 42)
            $col = if ($isBorder) { $accentColor } else { [System.Drawing.Color]::FromArgb(255, 15, 23, 42) }
            $bmp.SetPixel($x, $y, $col)
        }
    }
    
    # Stand connector (x 30 to 33, y 42 to 48)
    for ($x = 30; $x -le 33; $x++) {
        for ($y = 42; $y -le 48; $y++) {
            $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, 71, 85, 105))
        }
    }
    
    # Theme-specific pixel glyphs in center (x 16 to 47, y 14 to 38)
    if ($theme -eq "linux") {
        # Draw Terminal "$" symbol
        # S curve
        for ($x = 22; $x -le 28; $x++) { $bmp.SetPixel($x, 20, $glowColor); $bmp.SetPixel($x, 26, $glowColor); $bmp.SetPixel($x, 32, $glowColor) }
        $bmp.SetPixel(22, 21, $glowColor); $bmp.SetPixel(22, 22, $glowColor); $bmp.SetPixel(22, 23, $glowColor); $bmp.SetPixel(22, 24, $glowColor); $bmp.SetPixel(22, 25, $glowColor)
        $bmp.SetPixel(28, 27, $glowColor); $bmp.SetPixel(28, 28, $glowColor); $bmp.SetPixel(28, 29, $glowColor); $bmp.SetPixel(28, 30, $glowColor); $bmp.SetPixel(28, 31, $glowColor)
        for ($y = 17; $y -le 35; $y++) { $bmp.SetPixel(25, $y, $glowColor) }
        # Cursor "_"
        for ($x = 34; $x -le 42; $x++) { $bmp.SetPixel($x, 32, $glowColor); $bmp.SetPixel($x, 33, $glowColor) }
    }
    elseif ($theme -eq "filesystem") {
        # Folder glyph
        for ($x = 18; $x -le 28; $x++) { $bmp.SetPixel($x, 18, $glowColor); $bmp.SetPixel($x, 19, $glowColor) }
        for ($x = 18; $x -le 46; $x++) {
            $bmp.SetPixel($x, 20, $glowColor)
            $bmp.SetPixel($x, 34, $glowColor)
        }
        for ($y = 20; $y -le 34; $y++) {
            $bmp.SetPixel(18, $y, $glowColor)
            $bmp.SetPixel(46, $y, $glowColor)
        }
        # Inner file paper
        for ($x = 24; $x -le 40; $x++) {
            $bmp.SetPixel($x, 25, [System.Drawing.Color]::White)
            $bmp.SetPixel($x, 29, [System.Drawing.Color]::White)
        }
    }
    elseif ($theme -eq "process") {
        # Heartbeat / PID pulse line
        for ($x = 16; $x -le 24; $x++) { $bmp.SetPixel($x, 26, $glowColor) }
        $bmp.SetPixel(25, 23, $glowColor); $bmp.SetPixel(26, 18, $glowColor); $bmp.SetPixel(27, 16, $glowColor)
        $bmp.SetPixel(28, 22, $glowColor); $bmp.SetPixel(29, 32, $glowColor); $bmp.SetPixel(30, 36, $glowColor)
        $bmp.SetPixel(31, 30, $glowColor); $bmp.SetPixel(32, 26, $glowColor)
        for ($x = 33; $x -le 47; $x++) { $bmp.SetPixel($x, 26, $glowColor) }
        # Pulse dots
        $bmp.SetPixel(20, 32, $accentColor); $bmp.SetPixel(38, 20, $accentColor)
    }
    elseif ($theme -eq "network") {
        # Central node + 4 surrounding nodes + lines
        $centerCol = [System.Drawing.Color]::White
        # Center node (32, 26)
        for ($dx = -2; $dx -le 2; $dx++) {
            for ($dy = -2; $dy -le 2; $dy++) {
                $bmp.SetPixel(32 + $dx, 26 + $dy, $centerCol)
            }
        }
        # Surrounding nodes
        $nodes = @( @(20, 18), @(44, 18), @(20, 34), @(44, 34) )
        foreach ($n in $nodes) {
            $nx = $n[0]; $ny = $n[1]
            $bmp.SetPixel($nx, $ny, $glowColor); $bmp.SetPixel($nx+1, $ny, $glowColor); $bmp.SetPixel($nx, $ny+1, $glowColor); $bmp.SetPixel($nx+1, $ny+1, $glowColor)
            # connect lines
            $steps = 10
            for ($i = 0; $i -le $steps; $i++) {
                $lx = [math]::Round($nx + (32 - $nx) * ($i / $steps))
                $ly = [math]::Round($ny + (26 - $ny) * ($i / $steps))
                $bmp.SetPixel($lx, $ly, $accentColor)
            }
        }
    }
    elseif ($theme -eq "scripting") {
        # Code brackets { ; }
        # Left brace "{"
        $bmp.SetPixel(22, 18, $glowColor); $bmp.SetPixel(23, 18, $glowColor)
        $bmp.SetPixel(21, 19, $glowColor); $bmp.SetPixel(21, 22, $glowColor)
        $bmp.SetPixel(20, 23, $glowColor); $bmp.SetPixel(19, 24, $glowColor) # center tip
        $bmp.SetPixel(20, 25, $glowColor); $bmp.SetPixel(21, 26, $glowColor)
        $bmp.SetPixel(21, 29, $glowColor); $bmp.SetPixel(22, 30, $glowColor); $bmp.SetPixel(23, 30, $glowColor)
        # Semicolon ";"
        $bmp.SetPixel(32, 21, [System.Drawing.Color]::White); $bmp.SetPixel(32, 22, [System.Drawing.Color]::White)
        $bmp.SetPixel(32, 26, [System.Drawing.Color]::White); $bmp.SetPixel(31, 28, [System.Drawing.Color]::White)
        # Right brace "}"
        $bmp.SetPixel(41, 18, $glowColor); $bmp.SetPixel(40, 18, $glowColor)
        $bmp.SetPixel(42, 19, $glowColor); $bmp.SetPixel(42, 22, $glowColor)
        $bmp.SetPixel(43, 23, $glowColor); $bmp.SetPixel(44, 24, $glowColor) # center tip
        $bmp.SetPixel(43, 25, $glowColor); $bmp.SetPixel(42, 26, $glowColor)
        $bmp.SetPixel(42, 29, $glowColor); $bmp.SetPixel(41, 30, $glowColor); $bmp.SetPixel(40, 30, $glowColor)
    }
    
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

function Create-CardFrame {
    param([string]$path, [bool]$selected)
    $w = 128
    $h = 160
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $borderColor = if ($selected) { [System.Drawing.Color]::FromArgb(255, 0, 229, 255) } else { [System.Drawing.Color]::FromArgb(255, 51, 65, 85) }
    $bgColor = if ($selected) { [System.Drawing.Color]::FromArgb(240, 15, 30, 50) } else { [System.Drawing.Color]::FromArgb(230, 15, 23, 42) }
    $cornerColor = if ($selected) { [System.Drawing.Color]::FromArgb(255, 255, 255, 255) } else { [System.Drawing.Color]::FromArgb(255, 100, 116, 139) }
    
    for ($x = 0; $x -lt $w; $x++) {
        for ($y = 0; $y -lt $h; $y++) {
            $isCorner = ($x -lt 4 -and $y -lt 4) -or ($x -ge ($w - 4) -and $y -lt 4) -or ($x -lt 4 -and $y -ge ($h - 4)) -or ($x -ge ($w - 4) -and $y -ge ($h - 4))
            if ($isCorner) {
                # Corner studs
                $bmp.SetPixel($x, $y, $cornerColor)
            }
            elseif ($x -lt 3 -or $x -ge ($w - 3) -or $y -lt 3 -or $y -ge ($h - 3)) {
                $bmp.SetPixel($x, $y, $borderColor)
            }
            else {
                $bmp.SetPixel($x, $y, $bgColor)
            }
        }
    }
    
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

function Create-ButtonStartMission {
    param([string]$path)
    $w = 240
    $h = 56
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $border = [System.Drawing.Color]::FromArgb(255, 0, 255, 170)
    $bg = [System.Drawing.Color]::FromArgb(255, 13, 30, 45)
    $corner = [System.Drawing.Color]::FromArgb(255, 255, 255, 255)
    
    for ($x = 0; $x -lt $w; $x++) {
        for ($y = 0; $y -lt $h; $y++) {
            $isCorner = ($x -lt 3 -and $y -lt 3) -or ($x -ge ($w - 3) -and $y -lt 3) -or ($x -lt 3 -and $y -ge ($h - 3)) -or ($x -ge ($w - 3) -and $y -ge ($h - 3))
            if ($isCorner) {
                $bmp.SetPixel($x, $y, $corner)
            }
            elseif ($x -lt 3 -or $x -ge ($w - 3) -or $y -lt 3 -or $y -ge ($h - 3)) {
                $bmp.SetPixel($x, $y, $border)
            }
            else {
                $bmp.SetPixel($x, $y, $bg)
            }
        }
    }
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

# Generate all sprites
Write-Output "Generating pixel art sprites..."
Create-IsometricGrassTile "$artDir\ground_isometric_grass.png"
Create-IsometricTechTile "$artDir\ground_isometric_tech.png"
Create-MissionBoardIcon "$artDir\path_linux_basics.png" "linux" ([System.Drawing.Color]::FromArgb(255, 34, 197, 94)) ([System.Drawing.Color]::FromArgb(255, 74, 222, 128))
Create-MissionBoardIcon "$artDir\path_filesystem_explorer.png" "filesystem" ([System.Drawing.Color]::FromArgb(255, 234, 179, 8)) ([System.Drawing.Color]::FromArgb(255, 250, 204, 21))
Create-MissionBoardIcon "$artDir\path_process_detective.png" "process" ([System.Drawing.Color]::FromArgb(255, 168, 85, 247)) ([System.Drawing.Color]::FromArgb(255, 192, 132, 252))
Create-MissionBoardIcon "$artDir\path_network_recon.png" "network" ([System.Drawing.Color]::FromArgb(255, 14, 165, 233)) ([System.Drawing.Color]::FromArgb(255, 56, 189, 248))
Create-MissionBoardIcon "$artDir\path_scripting_lab.png" "scripting" ([System.Drawing.Color]::FromArgb(255, 239, 68, 68)) ([System.Drawing.Color]::FromArgb(255, 248, 113, 113))
Create-CardFrame "$artDir\card_frame_normal.png" $false
Create-CardFrame "$artDir\card_frame_selected.png" $true
Create-ButtonStartMission "$artDir\btn_start_mission.png"

Write-Output "Sprites generated successfully in $artDir"
