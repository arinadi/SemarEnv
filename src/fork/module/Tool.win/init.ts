import { copyFile, existsSync, mkdirp, readFile, writeFile, execPromiseWithEnv } from '../../Fn'
import { ForkPromise } from '@shared/ForkPromise'
import { dirname, join } from 'path'
import EnvSync from '@shared/EnvSync'

export function initAllowDir(json: string) {
  return new ForkPromise(async (resolve) => {
    const jsonFile = join(dirname(global.Server.AppDir!), 'bin/.semarenv.dir')
    await mkdirp(dirname(jsonFile))
    await writeFile(jsonFile, json)
    resolve(true)
  })
}

export function initSemarEnvSH() {
  return new ForkPromise(async (resolve) => {
    const psVersions = [
      { name: 'PowerShell 5.1', exe: 'powershell.exe', profileType: 'CurrentUserCurrentHost' },
      { name: 'PowerShell 7+', exe: 'pwsh.exe', profileType: 'CurrentUserAllHosts' }
    ]

    const semarenvScriptPath = join(dirname(global.Server.AppDir!), 'bin/semarenv.ps1')
    await mkdirp(dirname(semarenvScriptPath))
    await copyFile(join(global.Server.Static!, 'sh/semar-env.ps1'), semarenvScriptPath)

    for (const version of psVersions) {
      try {
        const profilePath = (
          await execPromiseWithEnv(`$PROFILE.${version.profileType}`, { shell: version.exe })
        ).stdout.trim()

        if (!profilePath || profilePath === '') continue

        // å†™å…¥é…ç½®ï¼ˆå¦‚æžœä¸å­˜åœ¨ï¼‰
        await mkdirp(dirname(profilePath))
        const loadCommand = `. "${semarenvScriptPath.replace(/\\/g, '/')}"\n`

        if (!existsSync(profilePath)) {
          await writeFile(profilePath, `# SemarEnv Auto-Load\n${loadCommand}`)
        } else {
          const content = await readFile(profilePath, 'utf-8')
          if (!content.includes(loadCommand.trim())) {
            await writeFile(profilePath, `${content.trim()}\n\n# SemarEnv Auto-Load\n${loadCommand}`)
          }
        }
      } catch (err) {
        console.log('initSemarEnvSH err: ', err)
      }
    }
    try {
      await EnvSync.sync()
      await execPromiseWithEnv(
        `if ((Get-ExecutionPolicy -Scope CurrentUser) -eq 'Restricted') {
  Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
}`,
        { shell: EnvSync.PowerShellPath || 'powershell.exe' }
      )
    } catch {}

    resolve(true)
  })
}
