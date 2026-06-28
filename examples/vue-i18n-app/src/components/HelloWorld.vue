<template>
  <div>
    <!-- Hardcoded template text — flagged. -->
    <h1>Cluster Manager</h1>

    <!-- Interpolated via t() — not flagged. -->
    <p>{{ t("greeting", { name }) }}</p>

    <!-- Bound :aria-label — not flagged. -->
    <button :aria-label="t('nav.home')">{{ t("nav.home") }}</button>

    <!-- Hardcoded alt — flagged. -->
    <img alt="Company logo" src="/logo.png" />
  </div>
</template>

<script setup>
import { useI18n } from "vue-i18n";
const { t } = useI18n();
const name = "Ada";
</script>
