import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildWindowsHelperFallbackPlan } from '../src/shared/WindowsHelperFallback'

const originalProgramData = process.env.ProgramData
const tempProgramData = path.join(os.tmpdir(), `semarenv-helper-plan-test-${Date.now()}`)
const allowedRootsDir = path.join(tempProgramData, 'SemarEnv')
const allowedRootsFile = path.join(allowedRootsDir, 'semarenv.allowed-roots')

process.env.ProgramData = tempProgramData
fs.mkdirSync(allowedRootsDir, { recursive: true })
fs.writeFileSync(allowedRootsFile, 'C:\\SemarEnv\n', 'utf8')

const inlineWritePlan = buildWindowsHelperFallbackPlan(
  'tools',
  'writeFileByRoot',
  ['C:/SemarEnv/semarenv-inline.txt', 'ok'],
  2000
)
assert.equal(inlineWritePlan.mode, 'inline')
assert.match(inlineWritePlan.command, /-EncodedCommand/)
assert.equal(inlineWritePlan.tempFileContent, undefined)

const emptyWritePlan = buildWindowsHelperFallbackPlan(
  'tools',
  'writeFileByRoot',
  ['C:/SemarEnv/empty.txt', ''],
  2000
)
assert.equal(emptyWritePlan.mode, 'inline')

const multilineWritePlan = buildWindowsHelperFallbackPlan(
  'tools',
  'writeFileByRoot',
  ['C:/SemarEnv/multiline.txt', 'line1\nline2'],
  2000
)
assert.equal(multilineWritePlan.mode, 'inline')

const tinyLimitPlan = buildWindowsHelperFallbackPlan(
  'tools',
  'writeFileByRoot',
  ['C:/SemarEnv/final-length.txt', 'ok'],
  80
)
assert.equal(tinyLimitPlan.mode, 'data-file')
assert.equal(tinyLimitPlan.tempFileKind, 'text')
assert.equal(tinyLimitPlan.tempFileContent, 'ok')
assert.match(tinyLimitPlan.script, /Get-Content -LiteralPath/)

const largeContent = 'x'.repeat(5000)
const dataFilePlan = buildWindowsHelperFallbackPlan(
  'tools',
  'writeFileByRoot',
  ['C:/SemarEnv/semarenv-large.txt', largeContent],
  2000
)
assert.equal(dataFilePlan.mode, 'data-file')
assert.equal(dataFilePlan.tempFileKind, 'text')
assert.equal(dataFilePlan.tempFileContent, largeContent)
assert.match(dataFilePlan.script, /Get-Content -LiteralPath/)

const tinyBase64LimitPlan = buildWindowsHelperFallbackPlan(
  'tools',
  'writeBufferBase64ByRoot',
  ['C:/SemarEnv/bin/semarenv-helper.exe', 'T0s='],
  80
)
assert.equal(tinyBase64LimitPlan.mode, 'data-file')
assert.equal(tinyBase64LimitPlan.tempFileKind, 'base64')
assert.equal(tinyBase64LimitPlan.tempFileContent, 'T0s=')
assert.match(tinyBase64LimitPlan.script, /Get-Content -LiteralPath/)

const setEnvPlan = buildWindowsHelperFallbackPlan(
  'tools',
  'setSystemEnv',
  ['SEMARENV_ALIAS', 'C:/SemarEnv/alias'],
  6000
)
assert.equal(setEnvPlan.mode, 'inline')
assert.match(setEnvPlan.script, /Set-ItemProperty/)

const setAutoStartPlan = buildWindowsHelperFallbackPlan(
  'tools',
  'setAutoStartWin',
  [true, 'SemarEnvStartup', 'C:/SemarEnv/semarenv.exe'],
  6000
)
assert.equal(setAutoStartPlan.mode, 'inline')
assert.match(setAutoStartPlan.script, /\$schtasksExe = \$null/)
assert.match(setAutoStartPlan.script, /Sysnative/)
assert.match(setAutoStartPlan.script, /System32/)
assert.doesNotMatch(setAutoStartPlan.script, /& schtasks\.exe /)
assert.match(setAutoStartPlan.script, /\/rl limited/)

const setHelperAutoStartPlan = buildWindowsHelperFallbackPlan(
  'tools',
  'setAutoStartWin',
  [true, 'SemarEnvHelperTask', 'C:/SemarEnv/semarenv-helper.exe'],
  6000
)
assert.match(setHelperAutoStartPlan.script, /\/rl highest/)

assert.throws(
  () => buildWindowsHelperFallbackPlan('tools', 'setSystemEnv', ['SEMARENV-ALIAS', 'x'], 2000),
  (error: unknown) => {
    assert.equal((error as { code?: string }).code, 'helper_execution_failed')
    return true
  }
)

assert.throws(
  () =>
    buildWindowsHelperFallbackPlan(
      'tools',
      'writeFileByRoot',
      ['D:/outside/project/test.txt', 'x'],
      2000
    ),
  (error: unknown) => {
    assert.equal((error as { code?: string }).code, 'helper_execution_failed')
    return true
  }
)

assert.throws(
  () =>
    buildWindowsHelperFallbackPlan(
      'tools',
      'writeBufferBase64ByRoot',
      ['C:/SemarEnv/buffer.bin', '***not-base64***'],
      2000
    ),
  (error: unknown) => {
    assert.equal((error as { code?: string }).code, 'helper_execution_failed')
    return true
  }
)

assert.throws(
  () =>
    buildWindowsHelperFallbackPlan(
      'tools',
      'setAutoStartWin',
      ['true', 'SemarEnvStartup', 'C:/SemarEnv/semarenv.exe'],
      2000
    ),
  (error: unknown) => {
    assert.equal((error as { code?: string }).code, 'helper_execution_failed')
    return true
  }
)

assert.throws(
  () =>
    buildWindowsHelperFallbackPlan(
      'tools',
      'writeFileByRoot',
      ['C:/Windows/System32/not-allowed.txt', 'x'],
      2000
    ),
  (error: unknown) => {
    assert.equal((error as { code?: string }).code, 'helper_execution_failed')
    return true
  }
)

assert.throws(
  () =>
    buildWindowsHelperFallbackPlan(
      'tools',
      'setAutoStartWin',
      [true, 'SemarEnvStartup', 'C:/Windows/System32/semarenv.exe'],
      2000
    ),
  (error: unknown) => {
    assert.equal((error as { code?: string }).code, 'helper_execution_failed')
    return true
  }
)

console.log('windows helper fallback plan test passed')

if (originalProgramData == null) {
  delete process.env.ProgramData
} else {
  process.env.ProgramData = originalProgramData
}
fs.rmSync(tempProgramData, { recursive: true, force: true })
