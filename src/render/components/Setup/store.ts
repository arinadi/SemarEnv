import { defineStore } from 'pinia'

interface State {
  tab: string
  uuid: string
  activeCode: string
  isActive: boolean
  message: string
  fetching: boolean
  githubAuthing: boolean
}

const state: State = {
  tab: 'base',
  uuid: '',
  activeCode: 'free',
  isActive: true,
  message: '',
  fetching: false,
  githubAuthing: false
}

export const SetupStore = defineStore('setup', {
  state: (): State => state,
  getters: {},
  actions: {
    init() {
      return Promise.resolve()
    },
    refreshState() {},
    postRequest() {},
    githubInfoSave() {},
    githubAuthStart() {},
    githubAuthCancel() {},
    githubAuthLogout() {},
    githubLicenseFetch() {},
    githubAuthDelBind(_uuid: string, _license: string) {},
    githubAuthAddBind(_uuid: string, _license: string) {}
  }
})
