import type { AfterPackContext } from 'electron-builder'
import { join, relative, dirname, basename } from 'node:path'
import { spawnSync } from 'node:child_process'
import _fs from 'fs-extra'

const { readdirSync, statSync, removeSync, writeFileSync } = _fs

// éœ€è¦é€ SignPath ç­¾åçš„ PE åŽç¼€
const SIGN_EXTS = ['.exe', '.dll', '.node']

interface SignOpts {
  orgId: string
  projectSlug: string
  policySlug: string
  artifactConfigSlug: string
}


function collectPeFiles(root: string): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      const st = statSync(full)
      if (st.isDirectory()) {
        walk(full)
      } else if (SIGN_EXTS.some((e) => name.toLowerCase().endsWith(e))) {
        out.push(full)
      }
    }
  }
  walk(root)
  return out
}

// ç”Ÿæˆåœ¨ Windows runner ä¸Šæ‰§è¡Œçš„ PowerShell è„šæœ¬:
// 1) ç”¨ .NET ZipFile æŒ‰ç›¸å¯¹è·¯å¾„åæ‰“åŒ…æ”¶é›†åˆ°çš„ PE æ–‡ä»¶(ä¿ç•™åµŒå¥—ç›®å½•)
// 2) Submit-SigningRequest æäº¤ SignPath,ç­‰å¾…å®Œæˆ,ä¸‹è½½ç­¾ååŽçš„ zip
// 3) é€ entry è§£åŽ‹è¦†ç›–å›ž appOutDir
function buildPsScript(appOutDir: string, relPaths: string[], opts: SignOpts, workName: string): string {
  const list = relPaths.map((p) => `'${p.replace(/'/g, "''")}'`).join(',\n    ')
  return `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$appDir = '${appOutDir.replace(/'/g, "''")}'
$work   = Join-Path $env:RUNNER_TEMP '${workName}'
$inZip  = Join-Path $work 'unsigned.zip'
$outZip = Join-Path $work 'signed.zip'
if (Test-Path $work) { Remove-Item -Recurse -Force $work }
New-Item -ItemType Directory -Path $work | Out-Null

# Relative paths (relative to appDir), used as zip entry names so structure can be restored
$rel = @(
    ${list}
)

# Pack by explicit entry name via .NET to avoid Compress-Archive flattening nested dirs.
# Two filters before packing:
#   1) Skip non-PE files (must start with 'MZ' header) - e.g. darwin/linux .node prebuilds
#      whose extension matches but content is Mach-O/ELF, which SignPath rejects.
#   2) Skip files already validly signed (e.g. Microsoft-signed dll).
function Test-IsPeFile {
  param([string]$Path)
  try {
    $fs = [System.IO.File]::OpenRead($Path)
    try {
      if ($fs.Length -lt 2) { return $false }
      $b0 = $fs.ReadByte(); $b1 = $fs.ReadByte()
      return ($b0 -eq 0x4D -and $b1 -eq 0x5A)
    } finally { $fs.Dispose() }
  } catch { return $false }
}

$zip = [System.IO.Compression.ZipFile]::Open($inZip, [System.IO.Compression.ZipArchiveMode]::Create)
$packed = 0
$skipped = 0
$nonpe = 0
try {
  foreach ($r in $rel) {
    $src = Join-Path $appDir $r
    if (-not (Test-IsPeFile $src)) {
      Write-Host ("[skip non-PE] {0}" -f $r)
      $nonpe++
      continue
    }
    $sig = Get-AuthenticodeSignature -FilePath $src
    if ($sig.Status -eq 'Valid') {
      Write-Host ("[skip already-signed] {0}" -f $r)
      $skipped++
      continue
    }
    $entryName = $r -replace '\\\\', '/'
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $src, $entryName) | Out-Null
    Write-Host ("[pack] {0}" -f $r)
    $packed++
  }
} finally {
  $zip.Dispose()
}
Write-Host ("[signpath] pack {0} file(s), skip {1} already-signed, skip {2} non-PE." -f $packed, $skipped, $nonpe)
if ($packed -eq 0) {
  Write-Host '[signpath] nothing to sign.'
  Remove-Item -Recurse -Force $work
  return
}

Import-Module SignPath
Submit-SigningRequest \`
  -InputArtifactPath $inZip \`
  -OutputArtifactPath $outZip \`
  -OrganizationId '${opts.orgId}' \`
  -ApiToken $env:SIGNPATH_API_TOKEN \`
  -ProjectSlug '${opts.projectSlug}' \`
  -SigningPolicySlug '${opts.policySlug}' \`
  -ArtifactConfigurationSlug '${opts.artifactConfigSlug}' \`
  -WaitForCompletion -Force \`
  -WaitForCompletionTimeoutInSeconds 1800

# Extract signed result entry by entry back into appDir (preserving original relative paths)
$signed = [System.IO.Compression.ZipFile]::OpenRead($outZip)
try {
  foreach ($e in $signed.Entries) {
    if ([string]::IsNullOrEmpty($e.Name)) { continue }
    $dest = Join-Path $appDir ($e.FullName -replace '/', '\\')
    $destDir = Split-Path $dest -Parent
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($e, $dest, $true)
  }
} finally {
  $signed.Dispose()
}

Remove-Item -Recurse -Force $work
Write-Host 'SignPath app-signing done.'
`
}

function resolveOpts(): SignOpts {
  return {
    orgId: process.env.SIGNPATH_ORGANIZATION_ID || '4db4007d-ac9e-4889-a8d5-52d4a421d989',
    projectSlug: process.env.SIGNPATH_PROJECT_SLUG || 'SemarEnv',
    policySlug: process.env.SIGNPATH_POLICY_SLUG || 'test-signing',
    artifactConfigSlug: process.env.SIGNPATH_APP_ARTIFACT_CONFIG_SLUG || 'windows-app'
  }
}

// åœ¨ baseDir å†…å¯¹ç»™å®šç›¸å¯¹è·¯å¾„é›†åˆåš SignPath æ‰¹é‡ç­¾å(ç”Ÿæˆ ps è„šæœ¬å¹¶æ‰§è¡Œ)
function signViaSignPath(baseDir: string, relPaths: string[], opts: SignOpts, workName: string, tag: string) {
  const script = buildPsScript(baseDir, relPaths, opts, workName)
  const scriptPath = join(baseDir, '..', `${workName}-${tag}.ps1`)
  writeFileSync(scriptPath, script, 'utf-8')
  try {
    const res = spawnSync(
      'pwsh',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      { stdio: 'inherit', env: process.env }
    )
    if (res.status !== 0) {
      throw new Error(`SignPath signing failed (exit ${res.status}, signal ${res.signal})`)
    }
  } finally {
    removeSync(scriptPath)
  }
}

export default async function (context: AfterPackContext) {
  if (context.electronPlatformName !== 'windows' && context.electronPlatformName !== 'win32') {
    return
  }

  // æœ¬é’©å­ç”± electron-builder.win.ts åœ¨ afterSign é˜¶æ®µè°ƒç”¨(rcedit ä¹‹åŽã€NSIS æ‰“åŒ…ä¹‹å‰),
  // ç¡®ä¿å¯¹ SemarEnv.exe çš„ç­¾åä¸ä¼šè¢« signApp é‡Œçš„ rcedit æ”¹å†™æŠ¹æŽ‰ã€‚
  // å®ˆå«:æœ¬åœ°æž„å»º(æ—  token)ç›´æŽ¥è·³è¿‡,ä¸å½±å“å¼€å‘
  const apiToken = process.env.SIGNPATH_API_TOKEN
  if (!apiToken) {
    console.log('[signpath] SIGNPATH_API_TOKEN not set, skip app code signing.')
    return
  }

  const opts = resolveOpts()
  const appOutDir = context.appOutDir
  const peFiles = collectPeFiles(appOutDir)
  if (peFiles.length === 0) {
    console.warn('[signpath] no PE files found under appOutDir, skip.')
    return
  }

  const relPaths = peFiles.map((f) => relative(appOutDir, f))
  console.log(`[signpath] submitting ${relPaths.length} PE files for app signing (policy=${opts.policySlug})`)
  signViaSignPath(appOutDir, relPaths, opts, 'signpath-app', `${context.arch}`)
}

// NSIS é˜¶æ®µæ‰ç”Ÿæˆçš„ PE(elevate.exe / å¸è½½å™¨),afterPack/afterSign é’©å­å¤Ÿä¸ç€ã€‚
// electron-builder å¤åˆ¶ elevate.exe åŽä¼šè°ƒ signIf â†’ è§¦å‘ win.signtoolOptions.sign è‡ªå®šä¹‰é’©å­ã€‚
// è¯¥é’©å­å¯¹**æ‰€æœ‰** PE éƒ½ä¼šè§¦å‘,è¿™é‡Œåªå¯¹ç™½åå•å†…çš„æ–‡ä»¶çœŸç­¾,å…¶ä½™ no-op
// (SemarEnv.exe / dll ç­‰ç”± afterSign æ‰¹é‡ç­¾;å®‰è£…å™¨å¤–å£³ç”± workflow ç¬¬äºŒæ®µç­¾)ã€‚
const CUSTOM_SIGN_WHITELIST = ['elevate.exe', 'uninstall.exe']

export async function customSign(configuration: { path: string; isNest?: boolean }) {
  // electron-builder é»˜è®¤å¯¹æ¯ä¸ªæ–‡ä»¶æŒ‰ [sha1, sha256] è°ƒç”¨ä¸¤æ¬¡(isNest: falseâ†’true);
  // SignPath ä¸€æ¬¡ç­¾åå³ä¸ºåŒç­¾,åªåœ¨ç¬¬ä¸€æ¬¡(isNest=false)å¤„ç†,é¿å…é‡å¤è¯·æ±‚ã€‚
  if (configuration.isNest) {
    return
  }
  const filePath = configuration.path
  const name = basename(filePath).toLowerCase()
  const hit =
    CUSTOM_SIGN_WHITELIST.includes(name) || name.includes('uninstall')
  if (!hit) {
    return // éžç™½åå•æ–‡ä»¶:äº¤ç»™å…¶å®ƒæµç¨‹,è¿™é‡Œä¸å¤„ç†
  }

  if (!process.env.SIGNPATH_API_TOKEN) {
    console.log(`[signpath] SIGNPATH_API_TOKEN not set, skip signing ${name}.`)
    return
  }

  const opts = resolveOpts()
  const baseDir = dirname(filePath)
  console.log(`[signpath] custom-signing NSIS artifact: ${name}`)
  // ä»¥è¯¥æ–‡ä»¶æ‰€åœ¨ç›®å½•ä¸ºåŸºå‡†,åªæŠŠè¿™ä¸€ä¸ªæ–‡ä»¶é€ç­¾;zip å†… entry åå³æ–‡ä»¶å,windows-app é…ç½®çš„ *.exe å¯åŒ¹é…
  signViaSignPath(baseDir, [basename(filePath)], opts, 'signpath-nsis', name.replace(/[^a-z0-9]/g, '_'))
}


