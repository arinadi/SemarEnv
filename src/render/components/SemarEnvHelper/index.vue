<template>
  <el-dialog
    v-model="show"
    :title="I18nT('menu.helperInstallTitle')"
    width="600px"
    :destroy-on-close="true"
    :close-on-click-modal="false"
    class="host-edit new-project installing"
    @closed="closedFn"
  >
    <template #default>
      <div class="main-wapper h-full">
        <div ref="xterm" class="h-full overflow-hidden"> </div>
      </div>
    </template>
    <template #footer>
      <div class="dialog-footer">
        <el-button :loading="loading" :disabled="loading" type="primary" @click="doEnd">{{
          I18nT('base.confirm')
        }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>
<script lang="ts" setup>
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, markRaw } from 'vue'
  import { AsyncComponentSetup } from '@/util/AsyncComponent'
  import { I18nT } from '@lang/index'
  import XTerm from '@/util/XTerm'
  import { SemarEnvHelperSetup } from '@/components/SemarEnvHelper/setup'
  import IPC from '@/util/IPC'

  const { show, onClosed, onSubmit, closedFn } = AsyncComponentSetup()

  SemarEnvHelperSetup.show = true

  const xterm = ref<HTMLElement>()

  const loading = computed({
    get() {
      return SemarEnvHelperSetup.loading
    },
    set(value) {
      SemarEnvHelperSetup.loading = value
    }
  })

  const fetchInstallCommand = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (SemarEnvHelperSetup.command) {
        return resolve(SemarEnvHelperSetup.command)
      }
      IPC.send('APP:SemarEnv-Helper-Command').then((key: string, res: any) => {
        IPC.off(key)
        if (res?.code !== 0 || !res?.command) {
          reject(new Error(res?.reason ?? 'helper_binary_missing'))
          return
        }
        SemarEnvHelperSetup.command = res.command
        resolve(SemarEnvHelperSetup.command)
      })
    })
  }

  const doInstall = async () => {
    if (loading.value) {
      return
    }
    loading.value = true
    try {
      const execXTerm = new XTerm()
      const c = await fetchInstallCommand()

      nextTick().then(() => {
        execXTerm.mount(xterm.value!).then(() => {
          execXTerm?.send([c])?.then(() => {
            loading.value = false
          })
        })
      })
      SemarEnvHelperSetup.execXTerm = markRaw(execXTerm)
    } catch {
      loading.value = false
      show.value = false
    }
  }

  onMounted(() => {
    if (loading.value) {
      nextTick().then(() => {
        const execXTerm = SemarEnvHelperSetup.execXTerm
        if (execXTerm && xterm.value) {
          execXTerm.mount(xterm.value)
        }
      })
    } else {
      doInstall()
    }
  })

  onBeforeUnmount(() => {
    const execXTerm = SemarEnvHelperSetup.execXTerm
    execXTerm?.unmounted?.()
    if (!loading.value) {
      execXTerm?.destroy?.()
      delete SemarEnvHelperSetup.execXTerm
    }
    SemarEnvHelperSetup.show = false
  })

  const doEnd = () => {
    SemarEnvHelperSetup.execXTerm?.destroy?.()
    delete SemarEnvHelperSetup.execXTerm
    show.value = false
  }

  defineExpose({
    show,
    onSubmit,
    onClosed
  })
</script>
