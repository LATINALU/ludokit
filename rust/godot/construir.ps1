# Compila la extensión y la copia al proyecto demo (Windows). Uso: .\construir.ps1 [-Debug]
param([switch]$Debug)
Set-Location $PSScriptRoot
if ($Debug) { cargo build; $perfil = "debug" } else { cargo build --release; $perfil = "release" }
if ($LASTEXITCODE -ne 0) { exit 1 }
Copy-Item "target/$perfil/ludokit_godot.dll" "demo/bin/" -Force
Write-Host "copiado demo/bin/ludokit_godot.dll"
