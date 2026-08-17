<template>
  <div class="fields">
    <template v-for="node in tree" :key="node.field.id">
      <section v-if="isGroupField(node.field)" class="group mi-card">
        <h3>{{ node.field.label }}</h3>
        <p v-if="!node.children.length" class="empty">该分组下暂无字段</p>
        <div v-else class="stack">
          <FormFieldItem
            v-for="child in node.children"
            :key="child.id"
            :field="child"
            :model-value="values[child.id]"
            :image-keys="imageKeys"
            @update:model-value="(v) => onChange(child.id, v)"
            @update:image-keys="(v) => emit('update:imageKeys', v)"
          />
        </div>
      </section>
      <FormFieldItem
        v-else
        :field="node.field"
        :model-value="values[node.field.id]"
        :image-keys="imageKeys"
        @update:model-value="(v) => onChange(node.field.id, v)"
        @update:image-keys="(v) => emit('update:imageKeys', v)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { buildFieldTree, isGroupField } from "~/lib/field-utils";
import type { FormFieldDefinition, FormFieldValues } from "~/lib/types";

const props = defineProps<{
  fields: FormFieldDefinition[];
  values: FormFieldValues;
  imageKeys: string[];
}>();

const emit = defineEmits<{
  change: [fieldId: string, value: FormFieldValues[string]];
  "update:imageKeys": [keys: string[]];
}>();

const tree = computed(() => buildFieldTree(props.fields || []));

function onChange(fieldId: string, value: FormFieldValues[string]) {
  emit("change", fieldId, value);
}
</script>

<style scoped>
.fields {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.group {
  padding: 12px;
}
.group h3 {
  margin: 0 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 14px;
}
.stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.empty {
  margin: 0;
  color: #8a8a8a;
  font-size: 12px;
}
</style>
