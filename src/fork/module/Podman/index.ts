import { Base } from '../Base'
import { ForkPromise } from '@shared/ForkPromise'
import type { SoftInstalled } from '@shared/app'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { uuid, execPromiseWithEnv, readFile, remove, existsSync, waitTime } from '../../Fn'
import { isLinux, isWindows } from '@shared/utils'
import axios from 'axios'
import { fetchTags } from './image'

class Podman extends Base {
  constructor() {
    super()
    this.type = 'podman'
  }

  private async getComposeCommand(): Promise<string> {
    try {
      await execPromiseWithEnv('docker-compose --version')
      return 'docker-compose'
    } catch {}

    await execPromiseWithEnv('docker compose version')
    return 'docker compose'
  }

  podmanInit() {
    return new ForkPromise(async (resolve) => {
      let version = ''
      let tmp = join(tmpdir(), `${uuid()}.txt`)
      try {
        await execPromiseWithEnv(`podman --version > "${tmp}" ${getRedirect()}`)
        version = await readFile(tmp, 'utf-8')
        version = version.split(' ')?.pop()?.trim() ?? ''
      } catch (e) {
        console.log('podman --version error: ', e)
        version = ''
      } finally {
        if (existsSync(tmp)) {
          await remove(tmp)
        }
      }

      const machine: any[] = []
      tmp = join(tmpdir(), `${uuid()}.txt`)
      try {
        await execPromiseWithEnv(`podman machine list --format json > "${tmp}" ${getRedirect()}`)
        const content = await readFile(tmp, 'utf-8')
        const json = JSON.parse(content)
        const arr = json.map((m: any) => ({
          name: m.Name,
          isDefault: m.Default,
          run: m.Running,
          running: m.Starting
        }))
        machine.push(...arr)
      } catch (e) {
        console.log('podman machine list error: ', e)
      } finally {
        if (existsSync(tmp)) {
          await remove(tmp)
        }
      }

      // èŽ·å–æ¯ä¸ªè™šæ‹Ÿæœºçš„è¯¦ç»†ä¿¡æ¯
      for (const m of machine) {
        tmp = join(tmpdir(), `${uuid()}.txt`)
        try {
          await execPromiseWithEnv(`podman machine inspect ${m.name} > "${tmp}" ${getRedirect()}`)
          const content = await readFile(tmp, 'utf-8')
          const info = JSON.parse(content)[0] ?? {}
          m.info = info
        } catch (e) {
          console.log(`podman machine inspect ${m.name} error: `, e)
        } finally {
          if (existsSync(tmp)) {
            await remove(tmp)
          }
        }
      }

      // æŒ‰åˆ›å»ºæ—¶é—´å€’åºæŽ’åˆ—ï¼Œæœ€æ–°åˆ›å»ºçš„åœ¨æœ€å‰
      machine.sort((a, b) => {
        const timeA = a.info?.Created ? new Date(a.info.Created).getTime() : 0
        const timeB = b.info?.Created ? new Date(b.info.Created).getTime() : 0
        return timeB - timeA
      })

      resolve({
        version,
        machine
      })
    })
  }

  fetchContainerList(machineName: string) {
    return new ForkPromise(async (resolve, reject) => {
      const tmp = join(tmpdir(), `${uuid()}.txt`)
      let containers: any[] = []
      try {
        const cmd = isLinux()
          ? `podman ps -a --format json > "${tmp}" ${getRedirect()}`
          : `podman --connection ${machineName} ps -a --format json > "${tmp}" ${getRedirect()}`
        await execPromiseWithEnv(cmd)
        const content = await readFile(tmp, 'utf-8')
        const json = JSON.parse(content)
        containers = json.map((c: any) => ({
          id: c.Id,
          name: c.Names,
          Image: c.Image,
          ImageID: c.ImageID,
          Mounts: c.Mounts,
          Networks: c.Networks,
          command: c.Command,
          run: c.State === 'running',
          running: false,
          machineName: machineName,
          Ports: c.Ports.map((p: any) => {
            return {
              in: p.container_port,
              out: p.host_port
            }
          })
        }))
        resolve(containers)
      } catch (e: any) {
        console.log('fetchContainerList error: ', e)
        reject(e?.message ?? 'fail')
      } finally {
        if (existsSync(tmp)) {
          await remove(tmp)
        }
      }
    })
  }

  fetchImageList(machineName: string) {
    return new ForkPromise(async (resolve, reject) => {
      const tmp = join(tmpdir(), `${uuid()}.txt`)
      let images: any[] = []
      try {
        const cmd = isLinux()
          ? `podman images --format json > "${tmp}" ${getRedirect()}`
          : `podman --connection ${machineName} images --format json > "${tmp}" ${getRedirect()}`
        await execPromiseWithEnv(cmd)
        const content = await readFile(tmp, 'utf-8')
        const json = JSON.parse(content)
        images = json.map((img: any) => ({
          id: img.Id,
          name: img.Names,
          tag: img.Tag,
          size: Number(img.Size),
          created: img.CreatedAt
        }))
        resolve(images)
      } catch (e: any) {
        console.log('fetchImageList error: ', e)
        reject(e?.message ?? 'fail')
      } finally {
        if (existsSync(tmp)) {
          await remove(tmp)
        }
      }
    })
  }

  machineStart(machineName: string) {
    return new ForkPromise(async (resolve, reject) => {
      try {
        await execPromiseWithEnv(`podman machine start ${machineName}`)
        resolve(true)
      } catch (e: any) {
        reject(e?.message ?? 'fail')
      }
    })
  }

  machineStop(machineName: string) {
    return new ForkPromise(async (resolve, reject) => {
      try {
        await execPromiseWithEnv(`podman machine stop ${machineName}`)
        resolve(true)
      } catch (e: any) {
        reject(e?.message ?? 'fail')
      }
    })
  }

  machineReStart(machineName: string) {
    return new ForkPromise(async (resolve, reject) => {
      try {
        await this.machineStop(machineName)
        await waitTime(500)
        await this.machineStart(machineName)
        resolve(true)
      } catch (e: any) {
        reject(e?.message ?? 'fail')
      }
    })
  }

  containerStart(containerName: string, machineName: string) {
    return new ForkPromise(async (resolve, reject) => {
      try {
        const cmd = isLinux()
          ? `podman start ${containerName}`
          : `podman --connection ${machineName} start ${containerName}`
        await execPromiseWithEnv(cmd)
        resolve(true)
      } catch (e: any) {
        reject(e?.message ?? 'fail')
      }
    })
  }

  containerStop(containerName: string, machineName: string) {
    return new ForkPromise(async (resolve, reject) => {
      try {
        const cmd = isLinux()
          ? `podman stop ${containerName}`
          : `podman --connection ${machineName} stop ${containerName}`
        await execPromiseWithEnv(cmd)
        resolve(true)
      } catch (e: any) {
        reject(e?.message ?? 'fail')
      }
    })
  }

  machineRemove(machineName: string) {
    return new ForkPromise(async (resolve, reject) => {
      try {
        await execPromiseWithEnv(`podman machine rm -f ${machineName}`)
        resolve(true)
      } catch (e: any) {
        reject(e?.message ?? 'fail')
      }
    })
  }

  machineInit(config: {
    name: string
    cpus: number
    memory: number
    disk: number
    isDefault: boolean
    rootful: boolean
    rosetta: boolean
    identityPath?: string
    remoteUsername?: string
  }) {
    return new ForkPromise(async (resolve, reject) => {
      try {
        const {
          name,
          cpus,
          memory,
          disk,
          isDefault,
          rootful,
          rosetta,
          identityPath,
          remoteUsername
        } = config

        console.log('machineInit config: ', config)

        const args: string[] = ['podman machine init']

        args.push(`--cpus ${cpus}`)
        args.push(`--memory ${memory}`)
        args.push(`--disk-size ${disk}`)

        if (isDefault) {
          args.push('--now')
        }
        if (rootful) {
          args.push('--rootful')
        } else {
          args.push('--rootful=false')
        }
        if (rosetta) {
          args.push('--rosetta')
        }
        if (identityPath) {
          args.push(`--identity-path "${identityPath}"`)
        }
        if (remoteUsername) {
          args.push(`--username "${remoteUsername}"`)
        }

        args.push(name)

        await execPromiseWithEnv(args.join(' '))
        resolve(true)
      } catch (e: any) {
        reject(e?.message ?? 'fail')
      }
    })
  }

  containerRemove(containerName: string, machineName: string) {
    return new ForkPromise(async (resolve, reject) => {
      try {
        const cmd = isLinux()
          ? `podman rm -f ${containerName}`
          : `podman --connection ${machineName} rm -f ${containerName}`
        await execPromiseWithEnv(cmd)
        resolve(true)
      } catch (e: any) {
        reject(e?.message ?? 'fail')
      }
    })
  }

  machineSet(config: { name: string; cpus: number; memory: number; rootful: boolean }) {
    return new ForkPromise(async (resolve, reject) => {
      try {
        const { name, cpus, memory, rootful } = config

        // å…ˆæ£€æŸ¥è™šæ‹Ÿæœºæ˜¯å¦åœ¨è¿è¡Œ
        let wasRunning = false
        try {
          const tmp = join(tmpdir(), `${uuid()}.txt`)
          await execPromiseWithEnv(`podman machine list --format json > "${tmp}" ${getRedirect()}`)
          const content = await readFile(tmp, 'utf-8')
          const machines = JSON.parse(content)
          const machine = machines.find((m: any) => m.Name === name)
          wasRunning = machine?.Running ?? false
          if (existsSync(tmp)) {
            await remove(tmp)
          }
        } catch {
          // ignore
        }

        // å¦‚æžœæ­£åœ¨è¿è¡Œï¼Œå…ˆåœæ­¢
        if (wasRunning) {
          await execPromiseWithEnv(`podman machine stop ${name}`)
        }

        const args: string[] = ['podman machine set']

        args.push(`--cpus ${cpus}`)
        args.push(`--memory ${memory}`)

        if (rootful) {
          args.push('--rootful')
        } else {
          args.push('--rootful=false')
        }

        args.push(name)

        await execPromiseWithEnv(args.join(' '))

        // å¦‚æžœä¹‹å‰æ˜¯è¿è¡ŒçŠ¶æ€ï¼Œé‡æ–°å¯åŠ¨
        if (wasRunning) {
          await execPromiseWithEnv(`podman machine start ${name}`)
        }

        resolve(true)
      } catch (e: any) {
        reject(e?.message ?? 'fail')
      }
    })
  }

  imagePull(machineName: string, imageName: string, tag: string = 'latest') {
    return new ForkPromise(async (resolve, reject) => {
      try {
        const cmd = isLinux()
          ? `podman pull ${imageName}:${tag}`
          : `podman --connection ${machineName} pull ${imageName}:${tag}`
        await execPromiseWithEnv(cmd)
        resolve(true)
      } catch (e: any) {
        reject(e?.message ?? 'fail')
      }
    })
  }

  imageRemove(machineName: string, imageId: string) {
    return new ForkPromise(async (resolve, reject) => {
      try {
        const cmd = isLinux()
          ? `podman rmi -f ${imageId}`
          : `podman --connection ${machineName} rmi -f ${imageId}`
        await execPromiseWithEnv(cmd)
        resolve(true)
      } catch (e: any) {
        reject(e?.message ?? 'fail')
      }
    })
  }

  fetchMachineInfo(machineName: string) {
    return new ForkPromise(async (resolve, reject) => {
      try {
        let info: any = {}
        if (isLinux()) {
          // Linux ä¸‹æ²¡æœ‰ machineï¼Œinfo å¯è¿”å›žç©ºå¯¹è±¡æˆ–æœ¬åœ° Podman ä¿¡æ¯
          info = {}
        } else {
          const infoTmp = join(tmpdir(), `${uuid()}.txt`)
          try {
            await execPromiseWithEnv(
              `podman machine inspect ${machineName} > "${infoTmp}" ${getRedirect()}`
            )
            const content = await readFile(infoTmp, 'utf-8')
            info = JSON.parse(content)[0] ?? {}
          } catch (e: any) {
            console.error('podman machine inspect: ', e?.message)
            info = {}
          } finally {
            if (existsSync(infoTmp)) {
              await remove(infoTmp)
            }
          }
        }

        // èŽ·å–å®¹å™¨åˆ—è¡¨
        const containerRes = await this.fetchContainerList(machineName)
        // èŽ·å–é•œåƒåˆ—è¡¨
        const imageRes = await this.fetchImageList(machineName)

        resolve({
          info,
          container: containerRes,
          images: imageRes
        })
      } catch (e: any) {
        console.error('fetchMachineInfo error: ', e?.message)
        reject(e?.message ?? 'fail')
      }
    })
  }

  fetchImagesVersion() {
    return new ForkPromise(async (resolve) => {
      const json = await axios({
        url: 'https://flyenv.com/static/podman/allImagesTags.json',
        method: 'get',
        timeout: 30000,
        withCredentials: false
      })
      resolve(json.data)
    })
  }

  composeStart(paths: string[], projectName: string, socket?: string) {
    return new ForkPromise(async (resolve, reject) => {
      const env: any = {}
      if (!isWindows() && socket) {
        env.DOCKER_HOST = `unix://${socket}`
      }
      try {
        const arr: string[] = [await this.getComposeCommand(), ...paths.map((p) => `-f "${p}"`)]
        if (projectName) {
          arr.push(`-p ${projectName}`)
        }
        arr.push('up -d')
        await execPromiseWithEnv(arr.join(' '), { env })
        resolve(true)
      } catch (e: any) {
        reject(e?.message ?? 'fail')
      }
    })
  }

  composeStop(paths: string[], projectName: string, socket?: string) {
    return new ForkPromise(async (resolve, reject) => {
      const env: any = {}
      if (!isWindows() && socket) {
        env.DOCKER_HOST = `unix://${socket}`
      }
      try {
        const arr: string[] = [await this.getComposeCommand(), ...paths.map((p) => `-f "${p}"`)]
        if (projectName) {
          arr.push(`-p ${projectName}`)
        }
        arr.push('down')
        await execPromiseWithEnv(arr.join(' '), { env })
        resolve(true)
      } catch (e: any) {
        reject(e?.message ?? 'fail')
      }
    })
  }

  checkIsComposeExists() {
    return new ForkPromise(async (resolve, reject) => {
      try {
        await this.getComposeCommand()
        resolve(true)
      } catch (err: any) {
        reject(err?.message ?? 'fail')
      }
    })
  }

  // å‡è®¾ composeName æ˜¯ä½ çš„ compose é¡¹ç›®åï¼ˆé€šå¸¸æ˜¯ Pod åï¼‰
  isComposeRunning(paths: string[], projectName: string, socket?: string) {
    return new ForkPromise(async (resolve, reject) => {
      const tmp = join(tmpdir(), `${uuid()}.txt`)
      const env: any = {}
      if (!isWindows() && socket) {
        env.DOCKER_HOST = `unix://${socket}`
      }
      console.log('isComposeRunning env: ', { env })
      try {
        const list: string[] = [await this.getComposeCommand(), ...paths.map((p) => `-f "${p}"`)]
        if (projectName) {
          list.push(`-p ${projectName}`)
        }
        list.push('ps --format json')
        await execPromiseWithEnv(`${list.join(' ')} > "${tmp}" ${getRedirect()}`, { env })
        const content = await readFile(tmp, 'utf-8')
        const arr = content.split('\n').filter((f) => {
          let json: any
          try {
            json = JSON.parse(f.trim())
          } catch {}
          return !!json
        })
        console.log('isComposeRunning arr: ', arr)
        resolve(arr.length > 0)
      } catch (e: any) {
        console.error('isComposeRunning error: ', e)
        reject(e?.message ?? 'fail')
      } finally {
        if (existsSync(tmp)) {
          await remove(tmp)
        }
      }
    })
  }

  isContainerRunning(containerName: string, machineName: string) {
    return new ForkPromise(async (resolve, reject) => {
      const tmp = join(tmpdir(), `${uuid()}.txt`)
      const cmd = isLinux()
        ? `podman inspect ${containerName} --format json > "${tmp}"`
        : `podman --connection ${machineName} inspect ${containerName} --format json > "${tmp}"`
      try {
        await execPromiseWithEnv(cmd)
        const content = await readFile(tmp, 'utf-8')
        const arr = JSON.parse(content)
        console.log('isContainerRunning arr: ', arr)
        const item: any = arr.shift()
        console.log('isContainerRunning item: ', item)
        resolve(item?.State?.Status === 'running')
      } catch (e: any) {
        reject(e?.message ?? 'fail')
      } finally {
        if (existsSync(tmp)) {
          await remove(tmp)
        }
      }
    })
  }

  fetchContainerInfo(id: string, machineName: string) {
    return new ForkPromise(async (resolve, reject) => {
      const tmp = join(tmpdir(), `${uuid()}.txt`)
      const cmd = isLinux()
        ? `podman inspect ${id} --format json > "${tmp}"`
        : `podman --connection ${machineName} inspect ${id} --format json > "${tmp}"`
      try {
        await execPromiseWithEnv(cmd)
        const content = await readFile(tmp, 'utf-8')
        const arr = JSON.parse(content)
        const item: any = arr.shift()
        resolve(item)
      } catch (e: any) {
        reject(e?.message ?? 'fail')
      } finally {
        if (existsSync(tmp)) {
          await remove(tmp)
        }
      }
    })
  }

  composeImageVersion(image: string) {
    return new ForkPromise(async (resolve, reject) => {
      fetchTags(image).then(resolve).catch(reject)
    })
  }

  getConfigFiles(_version?: SoftInstalled): Array<{ name: string; path: string }> {
    // Podman é€šè¿‡ç³»ç»Ÿ CLI ä¸Ž machine ç®¡ç†å®¹å™¨ï¼ŒSemarEnv æœªä¸ºå…¶ç»´æŠ¤ç‹¬ç«‹çš„é…ç½®æ–‡ä»¶
    return []
  }

  getLogFiles(_version?: SoftInstalled): Array<{ name: string; path: string }> {
    // Podman é€šè¿‡ç³»ç»Ÿ CLI ä¸Ž machine ç®¡ç†å®¹å™¨ï¼ŒSemarEnv æœªä¸ºå…¶ç»´æŠ¤ç‹¬ç«‹çš„æ—¥å¿—æ–‡ä»¶
    return []
  }
}

function getRedirect(): string {
  return isWindows() ? '2>NUL' : '2>/dev/null'
}

export default new Podman()
