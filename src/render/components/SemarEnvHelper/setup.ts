import { reactive } from 'vue'
import type { XTerm } from '@/util/XTerm'

type SemarEnvHelperSetupType = {
  execXTerm?: XTerm
  loading: boolean
  command: string
  show: boolean
}

export const SemarEnvHelperSetup: SemarEnvHelperSetupType = reactive({
  show: false,
  execXTerm: undefined,
  loading: false,
  command: ''
})
