<template>
  <div v-if="field.type !== 'group'" class="field">
    <div class="label">
      {{ field.label }}
      <span v-if="field.required" class="req">*</span>
    </div>

    <el-input
      v-if="field.type === 'text'"
      :model-value="stringValue"
      :placeholder="`请输入${field.label}`"
      @update:model-value="emitValue"
    />

    <el-input
      v-else-if="field.type === 'number'"
      :model-value="stringValue"
      type="number"
      :placeholder="`请输入${field.label}`"
      @update:model-value="emitValue"
    />

    <el-input
      v-else-if="field.type === 'textarea'"
      :model-value="stringValue"
      type="textarea"
      :rows="3"
      :placeholder="`请输入${field.label}`"
      @update:model-value="emitValue"
    />

    <el-select
      v-else-if="field.type === 'select' || field.type === 'radio'"
      :model-value="stringValue"
      placeholder="请选择"
      style="width: 100%"
      @update:model-value="emitValue"
    >
      <el-option
        v-for="option in field.options || []"
        :key="option"
        :label="option"
        :value="option"
      />
    </el-select>

    <el-date-picker
      v-else-if="field.type === 'date'"
      :model-value="stringValue || undefined"
      type="date"
      value-format="YYYY-MM-DD"
      placeholder="请选择日期"
      style="width: 100%"
      @update:model-value="onDateChange"
    />

    <div v-else-if="field.type === 'multi_select_with_custom'" class="multi">
      <div class="chips">
        <el-check-tag
          v-for="option in field.options || []"
          :key="option"
          :checked="arrayValue.includes(option)"
          @change="() => toggleOption(option)"
        >
          {{ option }}
        </el-check-tag>
      </div>
      <div v-if="arrayValue.length" class="selected">
        <el-tag
          v-for="item in arrayValue"
          :key="item"
          closable
          @close="removeItem(item)"
        >
          {{ item }}
        </el-tag>
      </div>
      <div class="custom-row">
        <el-input
          v-model="customText"
          placeholder="自定义选项"
          @keyup.enter.prevent="addCustom"
        />
        <el-button @click="addCustom">添加</el-button>
      </div>
    </div>

    <ImageUploadField
      v-else-if="field.type === 'image_upload'"
      :value="imageKeys"
      :max-count="field.multiple === false ? 1 : 9"
      @update:value="(v) => emit('update:imageKeys', v)"
    />

    <div v-else class="unsupported">
      暂不支持的字段类型：{{ field.type }}（{{ field.label }}）
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FormFieldDefinition, FormFieldValues } from "~/lib/types";

const props = defineProps<{
  field: FormFieldDefinition;
  modelValue: FormFieldValues[string];
  imageKeys: string[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: FormFieldValues[string]];
  "update:imageKeys": [keys: string[]];
}>();

const customText = ref("");

const stringValue = computed(() =>
  props.modelValue === undefined || props.modelValue === null
    ? ""
    : String(props.modelValue)
);

const arrayValue = computed(() =>
  Array.isArray(props.modelValue) ? (props.modelValue as string[]) : []
);

function emitValue(v: string) {
  emit("update:modelValue", v);
}

function onDateChange(v: string | null) {
  emitValue(v || "");
}

function toggleOption(option: string) {
  const set = new Set(arrayValue.value);
  if (set.has(option)) set.delete(option);
  else set.add(option);
  emit("update:modelValue", [...set]);
}

function removeItem(item: string) {
  emit(
    "update:modelValue",
    arrayValue.value.filter((x) => x !== item)
  );
}

function addCustom() {
  const text = customText.value.trim();
  if (!text) return;
  if (!arrayValue.value.includes(text)) {
    emit("update:modelValue", [...arrayValue.value, text]);
  }
  customText.value = "";
}
</script>

<style scoped>
.field .label {
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #4d4d4d;
}
.req {
  color: #ff6900;
}
.multi .chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.multi .selected {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.custom-row {
  display: flex;
  gap: 8px;
}
.unsupported {
  border: 1px dashed #ddd;
  border-radius: 12px;
  padding: 10px 12px;
  color: #8a8a8a;
  font-size: 12px;
}
</style>
