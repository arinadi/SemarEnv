<template>
  <div
    v-show="show"
    class="app-float-btn-wapper"
  >
    <ToolFlowButton v-if="showTool" />
  </div>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import { AppStore } from '@/store/app'
  import ToolFlowButton from '@/components/Tools/flowButton.vue'

  const appStore = AppStore()

  const show = computed(() => {
    return appStore.floatBtnShow
  })
  const showTool = computed(() => {
    return appStore?.config?.setup?.showTool ?? true
  })
</script>
