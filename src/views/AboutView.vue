<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { NCard, NEmpty } from "naive-ui";

const { t } = useI18n();
</script>

<template>
  <n-card :title="t('app.aboutTitle')" size="large">
    <n-empty :description="t('app.aboutDesc')" />
  </n-card>
</template>
