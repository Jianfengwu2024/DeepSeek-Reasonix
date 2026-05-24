# TRIADMIND_BOOTSTRAP_VERSION={{BOOTSTRAP_VERSION}}
$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir '..')
Set-Location $ProjectRoot

$TriadMindCommand = '{{TRIADMIND_COMMAND}}'

function Invoke-TriadMind {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Arguments
    )

    Invoke-Expression "$TriadMindCommand $Arguments"
}

Invoke-TriadMind "sync --force"
Invoke-TriadMind "runtime --visualize --view full"
cmd.exe /d /c "echo n| $TriadMindCommand plan --no-open --view architecture"
Invoke-Expression "$TriadMindCommand verify --strict --json" | Out-File -FilePath ".triadmind/bootstrap-verify.json" -Encoding utf8

Write-Host "[TriadMind] bootstrap verify written: .triadmind/bootstrap-verify.json"
