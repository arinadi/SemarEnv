[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$script:lastSemarenvDir = $null
$script:allowedPathsCache = $null

function global:Prompt {
  if ($null -eq $script:allowedPathsCache) {
    $script:allowedPathsCache = Get-SemarEnvAllowedPaths
  }

  $currentPath = $PWD.Path.Replace('/', '\').TrimEnd('\')
  $isAllowed = $script:allowedPathsCache -contains $currentPath

  if ($isAllowed -and (Test-Path ".semarenv") -and ($currentPath -ne $script:lastSemarenvDir)) {
    Write-Host "[SemarEnv] Loading environment variables..." -ForegroundColor Cyan
    try {
      Get-Content ".semarenv" -Encoding UTF8 | Invoke-Expression
      Write-Host "[SemarEnv] Load successful" -ForegroundColor Green
      $script:lastSemarenvDir = $currentPath
    } catch {
      Write-Host "[SemarEnv] Load failed: $_" -ForegroundColor Red
    }
  }

  if ($PSVersionTable.PSVersion.Major -ge 6) {
    "PS $($executionContext.SessionState.Path.CurrentLocation)$('>' * ($nestedPromptLevel + 1)) "
  } else {
    "PS $($pwd.Path)$('>' * ($nestedPromptLevel + 1)) "
  }
}

function Get-SemarEnvAllowedPaths {
  $configFile = Join-Path $PSScriptRoot ".semarenv.dir"
  if (Test-Path $configFile) {
    try {
      $jsonContent = Get-Content $configFile -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
      return $jsonContent | Where-Object { $_ -ne $null } | ForEach-Object {
        $_.ToString().Replace('/', '\').TrimEnd('\')
      }
    } catch {
      return @()
    }
  } else {
    return @()
  }
}
