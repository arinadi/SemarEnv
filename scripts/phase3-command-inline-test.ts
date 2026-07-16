import assert from 'node:assert/strict'

import { buildCodeRunInlineScript } from '../src/fork/module/Code/index'
import { buildUnixCustomerServiceStartScript } from '../src/fork/util/ServiceStart'
import { buildWindowsTerminalInlineScript } from '../src/shared/WindowsTerminal'

const hasNode = (file: string) => /node(?:\.exe)?$/i.test(file)
const hasBun = (file: string) => /bun(?:\.exe)?$/i.test(file)

const jsWindows = buildCodeRunInlineScript({
  type: 'javascript',
  runtimePath: 'C:\\SemarEnv\\node',
  sourceFile: 'C:\\SemarEnv Cache\\main.js',
  runDir: 'C:\\SemarEnv Cache',
  platform: 'win32',
  exists: hasNode
})
assert.ok(jsWindows.includes('$env:PATH'))
assert.ok(jsWindows.includes('node "C:\\SemarEnv Cache\\main.js"'))
assert.ok(!jsWindows.includes('Unblock-File'))
assert.ok(!jsWindows.includes('.ps1'))

const typescriptUnix = buildCodeRunInlineScript({
  type: 'typescript',
  runtimePath: '/opt/semarenv/node',
  sourceFile: '/tmp/semarenv cache/main.ts',
  runDir: '/tmp/semarenv cache',
  platform: 'darwin',
  exists: hasNode
})
assert.ok(typescriptUnix.includes('export PATH="/opt/semarenv/node/bin:/opt/semarenv/node:$PATH"'))
assert.ok(typescriptUnix.includes('tsx "/tmp/semarenv cache/main.ts"'))
assert.ok(!typescriptUnix.includes('.sh'))

const bunWindows = buildCodeRunInlineScript({
  type: 'javascript',
  runtimePath: 'C:\\SemarEnv\\bun',
  sourceFile: 'C:\\SemarEnv Cache\\main.js',
  runDir: 'C:\\SemarEnv Cache',
  platform: 'win32',
  exists: hasBun
})
assert.ok(bunWindows.includes('bun run "C:\\SemarEnv Cache\\main.js"'))

const customerCommand = buildUnixCustomerServiceStartScript({
  env: 'export PATH="/opt/semarenv/bin:$PATH"',
  cwd: '/tmp/semarenv project',
  commandType: 'command',
  command: 'npm run dev',
  commandFile: '',
  outFile: '/tmp/semarenv out.log',
  errFile: '/tmp/semarenv err.log',
  shell: '/bin/bash'
})
assert.ok(customerCommand.includes('cd "/tmp/semarenv project"'))
assert.ok(customerCommand.includes("nohup bash -lc 'npm run dev'"))
assert.ok(customerCommand.includes('> "/tmp/semarenv out.log" 2>"/tmp/semarenv err.log" &'))
assert.ok(!customerCommand.includes('.start.sh'))
assert.ok(!customerCommand.includes('start-'))

const customerFile = buildUnixCustomerServiceStartScript({
  env: '',
  cwd: '/tmp/semarenv project',
  commandType: 'file',
  command: '',
  commandFile: '/tmp/semarenv project/run.sh',
  outFile: '/tmp/semarenv out.log',
  errFile: '/tmp/semarenv err.log',
  shell: '/bin/zsh'
})
assert.ok(customerFile.includes('nohup "/tmp/semarenv project/run.sh"'))
assert.ok(!customerFile.includes('.start.sh'))

const terminalScript = buildWindowsTerminalInlineScript("Write-Output 'SemarEnv terminal ok'")
assert.ok(terminalScript.includes('Start-Process'))
assert.ok(terminalScript.includes('-EncodedCommand'))
assert.ok(!/['"]-File['"]/.test(terminalScript))
assert.ok(!terminalScript.includes('exec-by-terminal.ps1'))
assert.ok(!terminalScript.includes('command-'))

console.log('phase3 command inline tests passed')
