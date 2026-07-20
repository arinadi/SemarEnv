import { app } from 'electron'
import { resolve, join } from 'node:path'
import { isMacOS, isWindows } from '@shared/utils'
import is from 'electron-is'

/**
 * Get macOS run path
 */
const getMacOSRunPath = (): string => {
  const userData = app.getPath('userData')
  return resolve(userData, '../../SemarEnv')
}

/**
 * Get Windows portable path
 */
const getWindowsPortablePath = (): string => {
  const baseDir = process.env.PORTABLE_EXECUTABLE_DIR!
  return join(baseDir, 'SemarEnv-Data')
}

/**
 * Get Windows installed path
 */
const getWindowsInstalledPath = (): string => {
  const exePath = app.getPath('exe')
  return resolve(exePath, '../../SemarEnv-Data').split('\\').join('/')
}

/**
 * Get Windows run path
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
 * Determine run path
 */
export const DetermineRunPath = (): string => {
  let runpath = ''

  if (isMacOS()) {
    runpath = getMacOSRunPath()
  } else if (isWindows()) {
    runpath = getWindowsRunPath()
  } else {
    const SemarEnvPath = resolve(app.getPath('userData'), '../SemarEnv')
    runpath = SemarEnvPath
  }

  return runpath
}
