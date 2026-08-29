$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
Remove-Item Env:POKE_RENDERER_URL -ErrorAction SilentlyContinue
Set-Location $repo
& npm.cmd run electron:dev
