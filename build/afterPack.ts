import { join, resolve, dirname } from 'node:path'
import _fs from 'fs-extra'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { isLinux, isWindows } from "../src/shared/utils";
import type { PackContext } from 'app-builder-lib'

const { mkdirp, copyFile } = _fs
const execPromise = promisify(exec)

/**
 * Handle the app store node-pty Python library linking issue
 * @param {Object} pack - Pack object containing build information
 * @returns {Promise<boolean>}
 */
export default async function after(pack: PackContext) {
  if (isLinux()) {
    console.log('Linux pack: ', pack)
    /**
     * /home/arinadi/Desktop/GitHub/SemarEnv/release/linux-unpacked/resources/
     * {
     *   appOutDir: '/home/arinadi/Desktop/GitHub/SemarEnv/release/linux-unpacked',
     *   outDir: '/home/arinadi/Desktop/GitHub/SemarEnv/release',
     *   arch: 1,
     *   electronPlatformName: 'linux'
     * }
     */

    if (pack.arch === 1) {
      let fromBinDir = resolve(pack.appOutDir, '../../src/helper-go/dist/semarenv-helper-linux-amd64-v1')
      const toBinDir = join(pack.appOutDir, 'resources/helper/semarenv-helper')
      await mkdirp(dirname(toBinDir))
      await copyFile(fromBinDir, toBinDir)
    }
    // arm64
    else if (pack.arch === 3) {
      let fromBinDir = resolve(pack.appOutDir, '../../src/helper-go/dist/semarenv-helper-linux-arm64')
      const toBinDir = join(pack.appOutDir, 'resources/helper/semarenv-helper')
      await mkdirp(dirname(toBinDir))
      await copyFile(fromBinDir, toBinDir)
    }

    let shFile = join(pack.appOutDir, 'resources/helper/semarenv.sh')
    let tmplFile = resolve(pack.appOutDir, '../../static/sh/Linux/semar-env.sh')
    await copyFile(tmplFile, shFile)

    shFile = join(pack.appOutDir, 'resources/helper/semarenv-helper-init.sh')
    tmplFile = resolve(pack.appOutDir, '../../static/sh/Linux/semarenv-helper-init.sh')
    await copyFile(tmplFile, shFile)

    shFile = join(pack.appOutDir, 'resources/helper/512x512.png')
    tmplFile = resolve(pack.appOutDir, '../../static/512x512.png')
    await copyFile(tmplFile, shFile)
    console.log('afterPack handle end !!!!!!')
    return
  }
  if (isWindows()) {
    console.log('Windows pack: ', pack)
    if (pack.arch === 1) {
      let fromBinDir = resolve(pack.appOutDir, '../../src/helper-go/dist/semarenv-helper-windows-amd64-v1.exe')
      const toBinDir = join(pack.appOutDir, 'resources/helper/semarenv-helper.exe')
      await mkdirp(dirname(toBinDir))
      await copyFile(fromBinDir, toBinDir)
    }
    // arm64
    else if (pack.arch === 3) {
      let fromBinDir = resolve(pack.appOutDir, '../../src/helper-go/dist/semarenv-helper-windows-arm64.exe')
      const toBinDir = join(pack.appOutDir, 'resources/helper/semarenv-helper.exe')
      await mkdirp(dirname(toBinDir))
      await copyFile(fromBinDir, toBinDir)
    }
    console.log('afterPack handle end !!!!!!')
    return
  }
  if (pack.arch === 1) {
    const fromBinDir = resolve(pack.appOutDir, '../../src/helper-go/dist/semarenv-helper-darwin-amd64')
    const toBinDir = join(pack.appOutDir, 'SemarEnv.app/Contents/Resources/helper/semarenv-helper')
    await mkdirp(dirname(toBinDir))
    const command = `cp "${fromBinDir}" "${toBinDir}" && xattr -dr "com.apple.quarantine" "${toBinDir}" && chmod 755 "${toBinDir}"`
    console.log('command: ', command)
    await execPromise(command)
  }
  // arm64
  else if (pack.arch === 3) {
    const fromBinDir = resolve(pack.appOutDir, '../../src/helper-go/dist/semarenv-helper-darwin-arm64')
    const toBinDir = join(pack.appOutDir, 'SemarEnv.app/Contents/Resources/helper/semarenv-helper')
    await mkdirp(dirname(toBinDir))
    const command = `cp "${fromBinDir}" "${toBinDir}" && xattr -dr "com.apple.quarantine" "${toBinDir}" && chmod 755 "${toBinDir}"`
    console.log('command: ', command)
    await execPromise(command)
  }

  let fromBinDir = resolve(pack.appOutDir, '../../build/plist')
  let toBinDir = join(pack.appOutDir, 'SemarEnv.app/Contents/Resources/plist/')
  await mkdirp(toBinDir)
  let command = `cp ./* "${toBinDir}"`
  console.log('command: ', command)
  await execPromise(command, {
    cwd: fromBinDir
  })

  let shFile = join(pack.appOutDir, 'SemarEnv.app/Contents/Resources/helper/semarenv.sh')
  let tmplFile = resolve(pack.appOutDir, '../../static/sh/macOS/semar-env.sh')
  await copyFile(tmplFile, shFile)

  shFile = join(pack.appOutDir, 'SemarEnv.app/Contents/Resources/helper/semarenv-helper-init.sh')
  tmplFile = resolve(pack.appOutDir, '../../static/sh/macOS/semarenv-helper-init.sh')
  await copyFile(tmplFile, shFile)

  console.log('afterPack handle end !!!!!!')
  return
}
