<template>
  <div class="view" :class="{ compact }">
    <template v-for="field in sorted" :key="field.id">
      <p v-if="field.type === 'group'" class="group-label">{{ field.label }}</p>
      <div
        v-else-if="field.type !== 'image_upload'"
        class="item"
        :class="{ child: field.parentId }"
      >
        <p class="label">{{ field.label }}</p>
        <p class="value">{{ formatValue(data[field.id]) }}</p>
      </div>
    </template>

    <div v-if="images.length" class="photos">
      <p class="photos-title">现场照片</p>
      <div class="grid">
        <img
          v-for="key in images"
          :key="key"
          :src="getFileUrl(key)"
          alt=""
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatFieldDisplayValue } from "~/lib/submission-utils";
import type { FormFieldDefinition, FormFieldValues } from "~/lib/types";

const props = withDefaults(
  defineProps<{
    fields: FormFieldDefinition[];
    data: FormFieldValues;
    images?: string[];
    compact?: boolean;
  }>(),
  { images: () => [], compact: false }
);

const { getFileUrl } = useApi();

const sorted = computed(() =>
  [...(props.fields || [])].sort((a, b) => a.order - b.order)
);

function formatValue(value: unknown) {
  return formatFieldDisplayValue(value);
}
</script>

<style scoped>
.view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.view.compact {
  gap: 8px;
}
.group-label {
  margin: 4px 0 0;
  font-size: 12px;
  font-weight: 650;
  color: #8a8a8a;
}
.item {
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  padding: 10px 12px;
}
.item.child {
  margin-left: 12px;
}
.label {
  margin: 0 0 4px;
  font-size: 12px;
  color: #8a8a8a;
}
.value {
  margin: 0;
  font-size: 14px;
  color: #1a1a1a;
  word-break: break-word;
}
.photos-title {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 500;
  color: #8a8a8a;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.grid img {
  aspect-ratio: 1;
  width: 100%;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid #f0f0f0;
}
</style>
