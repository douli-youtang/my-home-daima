<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "admin" });

await navigateTo("/admin/docs/api", { replace: true });
</script>

<template>
  <p class="mi-muted">正在跳转到接口文档…</p>
</template>
