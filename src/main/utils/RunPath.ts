import { app } from 'electron'
import { resolve, join } from 'node:path'
import { existsSync } from 'node:fs'
import { isMacOS, isWindows } from '@shared/utils'
import is from 'electron-is'

/**
 * èŽ·å– macOS è¿è¡Œè·¯å¾„
 */
const getMacOSRunPath = (): string => {
  const userData = app.getPath('userData')
  const oldPath = resolve(userData, '../../PhpWebStudy')
  const SemarEnvPath = resolve(userData, '../../SemarEnv')
  const newPath = resolve(userData, '../../SemarEnv')

  if (existsSync(oldPath) && oldPath.includes('PhpWebStudy')) {
    return oldPath
  }
  // Fallback: use old SemarEnv path if it exists and SemarEnv path doesn't
  if (existsSync(SemarEnvPath) && !existsSync(newPath)) {
    return SemarEnvPath
  }
  return newPath
}

/**
 * èŽ·å– Windows ä¾¿æºç‰ˆè·¯å¾„
 */
const getWindowsPortablePath = (): string => {
  const baseDir = process.env.PORTABLE_EXECUTABLE_DIR!
  const oldPath = join(baseDir, 'PhpWebStudy-Data')
  const SemarEnvPath = join(baseDir, 'SemarEnv-Data')
  const newPath = join(baseDir, 'SemarEnv-Data')

  if (existsSync(oldPath)) return oldPath
  if (existsSync(SemarEnvPath)) return SemarEnvPath
  return newPath
}

/**
 * èŽ·å– Windows å®‰è£…ç‰ˆè·¯å¾„
 */
const getWindowsInstalledPath = (): string => {
  const exePath = app.getPath('exe')
  const oldPath = resolve(exePath, '../../PhpWebStudy-Data').split('\\').join('/')
  const oldPath1 = resolve(oldPath, '../../PhpWebStudy-Data').split('\\').join('/')
  const SemarEnvPath = resolve(exePath, '../../SemarEnv-Data').split('\\').join('/')
  const newPath = resolve(exePath, '../../SemarEnv-Data').split('\\').join('/')

  if (existsSync(oldPath) && oldPath.includes('PhpWebStudy-Data')) {
    return oldPath
  }
  if (existsSync(oldPath1) && oldPath1.includes('PhpWebStudy-Data')) {
    return oldPath1
  }
  if (existsSync(SemarEnvPath)) return SemarEnvPath
  return newPath
}

/**
 * èŽ·å– Windows è¿è¡Œè·¯å¾„
 */
const getWindowsRunPath = (): string => {
  if (is.dev()) {
    return resolve(__static, '../../../data')
  }

  if (process.env?.PORTABLE_EXECUTABLE_DIR) {
    return getWindowsPortablePath()
  }

  return getWindowsInstalledPath()
}

/**
 * ç¡®å®šè¿è¡Œè·¯å¾„
 */
export const DetermineRunPath = (): string => {
  let runpath = ''

  if (isMacOS()) {
    runpath = getMacOSRunPath()
  } else if (isWindows()) {
    runpath = getWindowsRunPath()
  } else {
    const SemarEnvPath = resolve(app.getPath('userData'), '../SemarEnv')
    const newPath = resolve(app.getPath('userData'), '../SemarEnv')
    runpath = existsSync(SemarEnvPath) ? SemarEnvPath : newPath
  }

  return runpath
}
