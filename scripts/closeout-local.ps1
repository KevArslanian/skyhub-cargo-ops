[CmdletBinding()]
param(
  [string]$DatabaseUrl,
  [string]$DatabaseUrlUnpooled,
  [string]$SessionSecret,
  [switch]$StartDevServer,
  [switch]$SkipInstall,
  [switch]$SkipMigrate,
  [switch]$SkipSeed,
  [switch]$SkipLint,
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$envFile = Join-Path $repoRoot ".env"
$envExampleFile = Join-Path $repoRoot ".env.example"

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function New-RandomSecret() {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  return [Convert]::ToBase64String($bytes)
}

function Parse-DotEnv([string]$Path) {
  $map = [ordered]@{}

  if (-not (Test-Path $Path)) {
    return $map
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match '^\s*#' -or [string]::IsNullOrWhiteSpace($line)) {
      continue
    }

    $parts = $line -split '=', 2
    if ($parts.Count -ne 2) {
      continue
    }

    $key = $parts[0].Trim()
    $value = $parts[1]
    $map[$key] = $value
  }

  return $map
}

function Save-DotEnv([System.Collections.IDictionary]$Values, [string]$Path) {
  $lines = @()
  foreach ($entry in $Values.GetEnumerator()) {
    $lines += "$($entry.Key)=$($entry.Value)"
  }

  [System.IO.File]::WriteAllLines($Path, $lines)
}

function Require-Value([string]$Value, [string]$Message) {
  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw $Message
  }

  return $Value
}

function Ensure-EnvFile() {
  if (-not (Test-Path $envExampleFile)) {
    throw "File .env.example tidak ditemukan di $envExampleFile."
  }

  $values = Parse-DotEnv -Path $envExampleFile

  if (Test-Path $envFile) {
    foreach ($entry in (Parse-DotEnv -Path $envFile).GetEnumerator()) {
      $values[$entry.Key] = $entry.Value
    }
  }

  if ($PSBoundParameters.ContainsKey("DatabaseUrl")) {
    $values["DATABASE_URL"] = $DatabaseUrl
  }

  if ($PSBoundParameters.ContainsKey("DatabaseUrlUnpooled")) {
    $values["DATABASE_URL_UNPOOLED"] = $DatabaseUrlUnpooled
  }

  if ($PSBoundParameters.ContainsKey("SessionSecret")) {
    $values["SESSION_SECRET"] = $SessionSecret
  }

  $values["DATABASE_PROVIDER"] = "postgresql"

  if (-not $values.Contains("SESSION_SECRET") -or $values["SESSION_SECRET"] -eq "change-this-to-a-long-random-secret") {
    $values["SESSION_SECRET"] = New-RandomSecret
  }

  if (-not $values.Contains("AUTH_COOKIE_SECURE")) {
    $values["AUTH_COOKIE_SECURE"] = "false"
  }

  if (-not $values.Contains("BLOB_READ_WRITE_TOKEN")) {
    $values["BLOB_READ_WRITE_TOKEN"] = ""
  }

  $databaseUrlValue = ""
  if ($values.Contains("DATABASE_URL")) {
    $databaseUrlValue = $values["DATABASE_URL"]
  }

  if ($databaseUrlValue -eq "postgresql://user:password@host/db?sslmode=require") {
    $databaseUrlValue = ""
  }

  $databaseUrlValue = Require-Value -Value $databaseUrlValue -Message "DATABASE_URL belum valid. Jalankan script ini dengan -DatabaseUrl atau isi .env terlebih dahulu."
  $values["DATABASE_URL"] = $databaseUrlValue

  if (-not $values.Contains("DATABASE_URL_UNPOOLED") -or [string]::IsNullOrWhiteSpace($values["DATABASE_URL_UNPOOLED"]) -or $values["DATABASE_URL_UNPOOLED"] -eq "postgresql://user:password@host/db?sslmode=require") {
    $values["DATABASE_URL_UNPOOLED"] = $values["DATABASE_URL"]
  }

  Save-DotEnv -Values $values -Path $envFile

  foreach ($entry in $values.GetEnumerator()) {
    [System.Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, "Process")
  }

  Write-Host "Menggunakan .env di $envFile" -ForegroundColor DarkGray
}

function Invoke-External([string]$Label, [string]$FilePath, [string[]]$Arguments) {
  Write-Step $Label
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Perintah gagal ($LASTEXITCODE): $FilePath $($Arguments -join ' ')"
  }
}

function Invoke-CmdLine([string]$Label, [string]$CommandLine) {
  Write-Step $Label
  & cmd.exe /d /c $CommandLine
  if ($LASTEXITCODE -ne 0) {
    throw "Perintah gagal ($LASTEXITCODE): $CommandLine"
  }
}

Push-Location $repoRoot

try {
  Ensure-EnvFile

  $corepack = Get-Command corepack.cmd -ErrorAction SilentlyContinue
  if (-not $corepack) {
    $corepack = Get-Command corepack -ErrorAction SilentlyContinue
  }

  if (-not $corepack) {
    throw "Corepack tidak ditemukan. Pastikan Node.js terpasang dengan benar."
  }

  Invoke-External -Label "Enable Corepack" -FilePath $corepack.Source -Arguments @("enable")
  Invoke-External -Label "Activate pnpm 9.0.0" -FilePath $corepack.Source -Arguments @("prepare", "pnpm@9.0.0", "--activate")

  $pnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
  if (-not $pnpm) {
    $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
  }

  if (-not $pnpm) {
    throw "pnpm tidak ditemukan setelah aktivasi Corepack."
  }

  Invoke-External -Label "Check pnpm version" -FilePath $pnpm.Source -Arguments @("--version")

  if (-not $SkipInstall) {
    Invoke-External -Label "Install dependencies" -FilePath $pnpm.Source -Arguments @("install", "--frozen-lockfile")
  }

  Invoke-External -Label "Generate Prisma client" -FilePath $pnpm.Source -Arguments @("prisma:generate")

  if (-not $SkipMigrate) {
    Invoke-External -Label "Apply Prisma migration" -FilePath $pnpm.Source -Arguments @("db:migrate")
  }

  if (-not $SkipSeed) {
    Invoke-External -Label "Seed database" -FilePath $pnpm.Source -Arguments @("db:seed")
  }

  if (-not $SkipLint) {
    Invoke-External -Label "Run lint" -FilePath $pnpm.Source -Arguments @("lint")
  }

  if (-not $SkipBuild) {
    Invoke-External -Label "Run build" -FilePath $pnpm.Source -Arguments @("build")
  }

  if ($StartDevServer) {
    Write-Step "Start dev server"
    Write-Host "Setelah server hidup, buka http://localhost:3000 dan lakukan browser verification." -ForegroundColor Yellow
    & $pnpm.Source "dev"
    if ($LASTEXITCODE -ne 0) {
      throw "Perintah gagal ($LASTEXITCODE): pnpm dev"
    }
  } else {
    Write-Host ""
    Write-Host "Validasi command selesai. Jalankan dev server dengan:" -ForegroundColor Green
    Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\closeout-local.ps1 -StartDevServer" -ForegroundColor Green
  }
}
finally {
  Pop-Location
}
