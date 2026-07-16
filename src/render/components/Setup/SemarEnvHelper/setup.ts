import { reactive } from 'vue'
import IPC from '@/util/IPC'
import { ElMessage } from 'element-plus'
import { I18nT } from '@lang/index'
import { SemarEnvHelperSetup } from '@/components/SemarEnvHelper/setup'
import { AsyncComponentShow } from '@/util/AsyncComponent'

export const SemarEnvHelperFix = reactive({
  fixing: false,
  doFix() {
    if (this.fixing) {
      return
    }
    this.fixing = true
    IPC.send('APP:SemarEnv-Helper-Check').then((key: string, res: any) => {
      IPC.off(key)
      if (res?.code === 0) {
        ElMessage.success(I18nT('setup.semarenvHelperFixSuccess'))
      } else if (res?.reason === 'helper_binary_missing') {
        ElMessage.error(I18nT('menu.helperInstallFailTips'))
      } else {
        if (!SemarEnvHelperSetup.show) {
          import('@/components/SemarEnvHelper/index.vue').then((m) => {
            AsyncComponentShow(m.default).then()
          })
        }
      }
      this.fixing = false
    })
  }
})
