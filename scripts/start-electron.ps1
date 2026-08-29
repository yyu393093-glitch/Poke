$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
Set-Location $repo
& npm.cmd run electron:dev
