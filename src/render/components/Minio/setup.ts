import { reactive } from 'vue'
import localForage from 'localforage'

export const MinioSetup: {
  dir: Record<string, string>
  init: () => void
  save: () => void
} = reactive({
  dir: {},
  init() {
    localForage
      .getItem('semarenv-minio-storage-dir')
      .then((res: Record<string, string>) => {
        if (res) {
          MinioSetup.dir = reactive(res)
        }
      })
      .catch()
  },
  save() {
    localForage
      .setItem('semarenv-minio-storage-dir', JSON.parse(JSON.stringify(MinioSetup.dir)))
      .then()
      .catch()
  }
})
