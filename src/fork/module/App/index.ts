import { Base } from '../Base'
import { machineId } from '../../Fn'
import { ForkPromise } from '@shared/ForkPromise'
import { arch } from 'os'
import axios from 'axios'
import { isMacOS, isWindows } from '@shared/utils'
import YAML from 'yamljs'
import { compareVersions } from '@shared/compare-versions'
import type { SoftInstalled } from '@shared/app'
import { isDEB } from '../../util/Linux'

class App extends Base {
  constructor() {
    super()
  }

  start(version: string) {
    return new ForkPromise(async (resolve, reject) => {
      try {
        resolve(true)
      } catch (err) {
        reject(err)
      }
    })
  }

  feedback(info: any) {
    return new ForkPromise(async (resolve, reject) => {
      try {
        resolve(true)
      } catch (e) {
        reject(e)
      }
    })
  }

  licensesInit() {
    return new ForkPromise(async (resolve) => {
      const uuid = await machineId()
      resolve({
        requestSuccess: true,
        uuid,
        activeCode: 'free',
        isActive: true
      })
    })
  }

  licensesState() {
    return new ForkPromise(async (resolve) => {
      const uuid = await machineId()
      resolve({
        uuid,
        activeCode: 'free',
        isActive: true
      })
    })
  }

  licensesRequest(_message: string) {
    return new ForkPromise(async (resolve, _reject) => {
      resolve(true)
    })
  }

  checkAppVersionUpdate() {
    return new ForkPromise(async (resolve, reject) => {
      let file = 'latest.yml'
      const a = arch()
      if (isMacOS()) {
        if (a === 'x64') {
          file = 'latest-mac.yml'
        } else {
          file = 'latest-mac-arm64.yml'
        }
      } else if (isWindows()) {
        file = 'latest.yml'
      } else {
        if (a === 'x64') {
          file = 'latest-linux.yml'
        } else {
          file = 'latest-linux-arm64.yml'
        }
      }
      try {
        const res = await axios({
          url: `https://raw.githubusercontent.com/arinadi/SemarEnv/refs/heads/master/${file}`,
          method: 'get',
          proxy: this.getAxiosProxy()
        })
        const content = res.data
        const json = YAML.parse(content)
        const version = json['version']
        const check = compareVersions(version, global.Server.APPVersion)
        let name = ''
        if (isMacOS()) {
          if (a === 'x64') {
            name = `SemarEnv-${version}.dmg`
          } else {
            name = `SemarEnv-${version}-arm64.dmg`
          }
        } else if (isWindows()) {
          name = `SemarEnv-Setup-${version}.exe`
        } else {
          const isdeb = await isDEB()
          const ext = isdeb ? '.deb' : '.rpm'
          if (a === 'x64') {
            name = `SemarEnv-${version}-x64${ext}`
          } else {
            name = `SemarEnv-${version}-arm64${ext}`
          }
        }
        const url = `https://github.com/arinadi/SemarEnv/releases/download/v${version}/${name}`
        resolve({
          app: global.Server.APPVersion,
          online: version,
          check,
          url
        })
      } catch (e) {
        reject(e)
      }
    })
  }

  getConfigFiles(_version?: SoftInstalled): Array<{ name: string; path: string }> {
    return []
  }

  getLogFiles(_version?: SoftInstalled): Array<{ name: string; path: string }> {
    return []
  }
}

export default new App()
