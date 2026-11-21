# Verifica toda la librería en todos los lenguajes disponibles (Windows PowerShell 5.1+).
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
$fallos = 0
function Paso($t) { Write-Host ""; Write-Host "== $t" }

Paso "TypeScript: tipos"
npx tsc -p tsconfig.json; if ($LASTEXITCODE -ne 0) { $fallos++ }

Paso "TypeScript: pruebas"
node --test test/*.test.ts test/*.test.mjs; if ($LASTEXITCODE -ne 0) { $fallos++ }

if (Get-Command cargo -ErrorAction SilentlyContinue) {
  Paso "Rust: pruebas contra los vectores"
  Push-Location rust; cargo test --quiet; if ($LASTEXITCODE -ne 0) { $fallos++ }; Pop-Location
  Paso "Shaders: validar WGSL y generar GLSL"
  Push-Location shaders/compilador; cargo run --quiet --release -- (Get-ChildItem ../*.wgsl | ForEach-Object { $_.FullName }); if ($LASTEXITCODE -ne 0) { $fallos++ }; Pop-Location
} else { Write-Host "(cargo no está instalado: se saltan Rust y shaders)" }

if (Get-Command python -ErrorAction SilentlyContinue) {
  Paso "Python: pruebas contra los vectores"
  Push-Location python; python -I pruebas/test_herramientas.py; if ($LASTEXITCODE -ne 0) { $fallos++ }; Pop-Location
}

$cxx = @("g++", "clang++") | Where-Object { Get-Command $_ -ErrorAction SilentlyContinue } | Select-Object -First 1
if ($cxx) {
  Paso "C++: pruebas contra los vectores ($cxx)"
  Push-Location cpp; & $cxx -std=c++17 -O2 -Wall -Wextra pruebas.cpp -o "$env:TEMP\ludokit_pruebas.exe"; if ($LASTEXITCODE -eq 0) { & "$env:TEMP\ludokit_pruebas.exe" }; if ($LASTEXITCODE -ne 0) { $fallos++ }; Pop-Location
} elseif (Get-Command cl -ErrorAction SilentlyContinue) {
  Paso "C++: pruebas contra los vectores (MSVC)"
  Push-Location cpp; cl /nologo /std:c++17 /EHsc /W4 pruebas.cpp /Fe:"$env:TEMP\ludokit_pruebas.exe"; if ($LASTEXITCODE -eq 0) { & "$env:TEMP\ludokit_pruebas.exe" }; if ($LASTEXITCODE -ne 0) { $fallos++ }; Pop-Location
} else { Write-Host ""; Write-Host "(sin compilador de C++: se saltan las pruebas de cpp/)" }

Write-Host ""
if ($fallos -eq 0) { Write-Host "OK: todo verificado" } else { Write-Host "FALLARON $fallos etapas"; exit 1 }
