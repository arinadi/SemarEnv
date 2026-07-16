<template>
  <div class="plant-title flex items-center gap-1">
    <span>{{ I18nT('setup.semarenvHelper') }}</span>
  </div>
  <div class="main reset-pass">
    <el-button
      :loading="SemarEnvHelperFix.fixing"
      :disabled="SemarEnvHelperFix.fixing"
      @click.stop="SemarEnvHelperFix.doFix()"
      >{{ I18nT('setup.semarenvHelperBtn') }}</el-button
    >
  </div>
</template>

<script setup lang="ts">
  import { I18nT } from '@lang/index'
  import { SemarEnvHelperFix } from '@/components/Setup/SemarEnvHelper/setup'
</script>
