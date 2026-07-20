import localForage from 'localforage'
import { reactiveBind } from '@/util/Index'
import IPC from '@/util/IPC'
import { MessageSuccess } from '@/util/Element'
import { I18nT } from '@lang/index'

class CapturerSetup {
  key: string[] = []
  name = 'semarenv-capturer-{timestamp}'
  dir = ''
  trialStartTime: number = 0

  private onConfigUpdate() {
    IPC.send('Capturer:Config-Update', JSON.parse(JSON.stringify(this))).then((key: string) => {
      IPC.off(key)
    })
  }

  init() {
    localForage.getItem('semarenv-capturer-setup').then((res: any) => {
      if (res) {
        this.key = res.key
        this.name = res.name
        this.dir = res.dir
        this.trialStartTime = res?.trialStartTime ?? 0
        this.onConfigUpdate()
      }
    })
  }

  save(updateConfig = true) {
    localForage.setItem('semarenv-capturer-setup', JSON.parse(JSON.stringify(this))).catch()
    if (updateConfig) {
      this.onConfigUpdate()
      MessageSuccess(I18nT('base.success'))
    }
  }
}
export default reactiveBind(new CapturerSetup())
