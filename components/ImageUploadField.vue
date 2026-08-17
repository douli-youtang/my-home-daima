<template>
  <div>
    <div class="grid">
      <div v-for="(src, index) in previews" :key="`${value[index]}-${index}`" class="thumb">
        <img :src="src" :alt="`preview-${index}`" />
        <button type="button" class="remove" @click="removeAt(index)">×</button>
      </div>
      <button
        v-if="value.length < maxCount"
        type="button"
        class="add"
        :disabled="uploading"
        @click="inputRef?.click()"
      >
        <span class="plus">+</span>
        <span>{{ uploading ? "上传中" : "添加图片" }}</span>
      </button>
    </div>
    <input
      ref="inputRef"
      type="file"
      accept="image/*"
      multiple
      class="hidden"
      @change="onSelect"
    />
    <p v-if="error" class="err">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    value: string[];
    maxCount?: number;
  }>(),
  { maxCount: 9 }
);

const emit = defineEmits<{
  "update:value": [keys: string[]];
  change: [keys: string[]];
}>();

const { getFileUrl } = useApi();
const inputRef = ref<HTMLInputElement | null>(null);
const blobMap = new Map<string, string>();
const previews = ref<string[]>([]);
const uploading = ref(false);
const error = ref("");

function syncPreviews(keys: string[]) {
  previews.value = keys.map((key) => blobMap.get(key) || getFileUrl(key));
  for (const [key, url] of [...blobMap.entries()]) {
    if (!keys.includes(key)) {
      URL.revokeObjectURL(url);
      blobMap.delete(key);
    }
  }
}

watch(
  () => props.value,
  (keys) => syncPreviews(keys || []),
  { immediate: true }
);

onBeforeUnmount(() => {
  for (const url of blobMap.values()) URL.revokeObjectURL(url);
  blobMap.clear();
});

function setKeys(keys: string[]) {
  emit("update:value", keys);
  emit("change", keys);
}

async function onSelect(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (!files?.length) return;
  const remain = props.maxCount - props.value.length;
  if (remain <= 0) {
    error.value = `最多上传 ${props.maxCount} 张图片`;
    return;
  }
  const selected = Array.from(files).slice(0, remain);
  error.value = "";
  uploading.value = true;
  try {
    const keys: string[] = [];
    for (const file of selected) {
      if (!file.type.startsWith("image/")) {
        throw new Error("仅支持上传图片文件");
      }
      const formData = new FormData();
      formData.append("file", file);
      const key = await apiRequest<string>("/api/upload", {
        method: "POST",
        body: formData,
      });
      blobMap.set(key, URL.createObjectURL(file));
      keys.push(key);
    }
    setKeys([...props.value, ...keys]);
  } catch (err: any) {
    error.value = err?.message || "上传失败";
  } finally {
    uploading.value = false;
    if (inputRef.value) inputRef.value.value = "";
  }
}

function removeAt(index: number) {
  const key = props.value[index];
  if (key && blobMap.has(key)) {
    URL.revokeObjectURL(blobMap.get(key)!);
    blobMap.delete(key);
  }
  setKeys(props.value.filter((_, i) => i !== index));
}
</script>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.thumb {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 12px;
  background: #f5f5f5;
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  cursor: pointer;
  line-height: 1;
}
.add {
  aspect-ratio: 1;
  border: 1px dashed #d0d0d0;
  border-radius: 12px;
  background: #fafafa;
  color: #8a8a8a;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  cursor: pointer;
}
.add:disabled {
  opacity: 0.6;
}
.plus {
  font-size: 22px;
  line-height: 1;
}
.hidden {
  display: none;
}
.err {
  margin: 8px 0 0;
  color: #f56c6c;
  font-size: 12px;
}
</style>
