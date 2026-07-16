import assert from 'node:assert/strict'

import {
  renderWindowsPipInstallScript,
  renderWindowsPythonInstallScript
} from '../src/fork/module/Python/index'
import { buildWindowsCronWrapperScript } from '../src/fork/module/Cron/WindowsSystemScheduler'
import { buildWindowsTerminalInlineScript } from '../src/shared/WindowsTerminal'
import { powerShellInlineArgs } from '../src/shared/PowerShellCommand'

const pythonInstall = renderWindowsPythonInstallScript(
  'cd "#DARKDIR#"\n./dark.exe -x "#TMPL#" "#EXE#"\n$targetDir = "#APPDIR#"',
  {
    darkDir: 'C:\\SemarEnv\\cache\\dark',
    tmpDir: 'C:\\SemarEnv\\cache\\python tmp',
    exe: 'C:\\SemarEnv\\cache\\python.exe',
    appDir: 'C:\\SemarEnv\\app\\python'
  }
)
assert.ok(pythonInstall.includes('C:\\SemarEnv\\cache\\dark'))
assert.ok(pythonInstall.includes('C:\\SemarEnv\\cache\\python tmp'))
assert.ok(!pythonInstall.includes('#DARKDIR#'))
assert.ok(!pythonInstall.includes('#TMPL#'))
assert.ok(powerShellInlineArgs(pythonInstall).includes('-EncodedCommand'))
assert.ok(!powerShellInlineArgs(pythonInstall).includes('-File'))

const pipInstall = renderWindowsPipInstallScript('cd "#APPDIR#"\n./python.exe -m ensurepip', {
  appDir: 'C:\\SemarEnv\\app\\python'
})
assert.ok(pipInstall.includes('C:\\SemarEnv\\app\\python'))
assert.ok(!pipInstall.includes('#APPDIR#'))

const terminalScript = buildWindowsTerminalInlineScript("Write-Output 'SemarEnv terminal ok'")
assert.ok(terminalScript.includes('Start-Process'))
assert.ok(terminalScript.includes('-EncodedCommand'))
assert.ok(!/['"]-File['"]/.test(terminalScript))
assert.ok(!terminalScript.includes('exec-by-terminal.ps1'))
assert.ok(!terminalScript.includes('command-'))

const cronWrapper = buildWindowsCronWrapperScript({
  jobId: 'job-1',
  hostId: undefined,
  scope: 'global',
  command: 'echo SemarEnv Cron',
  workDir: 'C:\\SemarEnv Project',
  runDir: 'C:\\SemarEnv\\cron\\tmp',
  logFile: 'C:\\SemarEnv\\cron\\job-1.log',
  cmdExe: 'C:\\Windows\\System32\\cmd.exe',
  envPath: 'C:\\Windows\\System32'
})
assert.ok(cronWrapper.includes('$psi.FileName = $CmdExe'))
assert.ok(cronWrapper.includes("$psi.Arguments = '/d /s /c ' + $Command"))
assert.ok(!cronWrapper.includes('$CmdFile'))
assert.ok(!cronWrapper.includes('WriteAllText($CmdFile'))
assert.ok(!cronWrapper.includes('.cmd'))

console.log('phase4 install terminal cron tests passed')
