<template>
  <div class="page">
    <div v-if="loading" class="mi-card state">加载工单...</div>
    <div v-else-if="error || !detail" class="mi-card state">
      <p>{{ error || "记录不存在" }}</p>
      <el-button type="primary" @click="load">重试</el-button>
      <el-button @click="router.push('/worker')">返回列表</el-button>
    </div>

    <template v-else-if="mode === 'edit'">
      <div class="mi-card block">
        <p class="meta">修改填报</p>
        <p class="title">{{ detail.pointName }}</p>
        <p class="amber">
          第 {{ detail.editCount + 1 }} 次修改 · 共可修改 {{ detail.maxEdits }} 次
          <template v-if="detail.editWindowHours && detail.editWindowHours > 0">
            · 提交后 {{ detail.editWindowHours }} 小时内可改
          </template>
          <template v-else-if="detail.editWindowHours === 0"> · 不限时间</template>
        </p>
      </div>
      <div class="mi-card block">
        <DynamicFormFields
          :fields="fields"
          :values="values"
          :image-keys="imageKeys"
          @change="onFieldChange"
          @update:image-keys="(v) => (imageKeys = v)"
        />
      </div>
      <el-button
        type="primary"
        class="mi-press"
        :loading="submitting"
        @click="handleEditSubmit"
      >
        保存修改
      </el-button>
      <el-button @click="mode = 'view'">取消</el-button>
    </template>

    <template v-else>
      <div class="mi-card block">
        <p class="title">{{ detail.pointName || "工单详情" }}</p>
        <p class="meta">提交人：{{ detail.submitterName || sessionName || "-" }}</p>
        <p class="meta">
          填写人：{{ detail.submittedBy }} · {{ formatTime(detail.submittedAt) }}
        </p>
        <p v-if="detail.canEdit" class="amber">
          还可修改 {{ detail.remainingEdits }} 次
          <template v-if="detail.editableUntil">
            · 截止 {{ formatTime(detail.editableUntil) }}
          </template>
        </p>
        <p v-else class="meta">{{ detail.editLockMessage || "当前不可修改" }}</p>
      </div>

      <div class="mi-card block">
        <p class="section">提交内容</p>
        <SubmissionDataView
          :fields="fields"
          :data="detail.data"
          :images="detail.images"
        />
      </div>

      <el-button
        v-if="detail.canEdit"
        class="mi-press"
        @click="startEdit"
      >
        修改（剩余 {{ detail.remainingEdits }} 次）
      </el-button>
      <el-button text type="primary" @click="router.push('/worker')">返回列表</el-button>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { WorkerSubmissionDetail } from "~/lib/client-api";
import { extractSubmittedBy } from "~/lib/submission-utils";
import type { FormFieldDefinition, FormFieldValues } from "~/lib/types";

definePageMeta({
  layout: "worker",
  middleware: "worker",
  title: "工单详情",
});

type Mode = "view" | "edit";

const route = useRoute();
const router = useRouter();
const { getStoredSession } = useSession();

const id = computed(() => String(route.params.id || ""));
const openid = ref("");
const sessionName = ref("");
const detail = ref<WorkerSubmissionDetail | null>(null);
const mode = ref<Mode>("view");
const values = ref<FormFieldValues>({});
const imageKeys = ref<string[]>([]);
const loading = ref(true);
const submitting = ref(false);
const error = ref("");

const fields = computed(() =>
  [...(detail.value?.fieldsSnapshot || [])].sort((a, b) => a.order - b.order)
);

function formatTime(value: string) {
  try {
    return new Date(value).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return value;
  }
}

function createInitialValues(list: FormFieldDefinition[]): FormFieldValues {
  const next: FormFieldValues = {};
  for (const field of list) {
    if (field.type === "group") continue;
    if (field.type === "multi_select_with_custom" || field.type === "image_upload") {
      next[field.id] = [];
    } else {
      next[field.id] = "";
    }
  }
  return next;
}

function valuesFromSubmission(
  list: FormFieldDefinition[],
  data: FormFieldValues
): FormFieldValues {
  const next = createInitialValues(list);
  for (const field of list) {
    if (field.type === "group" || field.type === "image_upload") continue;
    if (data[field.id] !== undefined) {
      next[field.id] = data[field.id] as FormFieldValues[string];
    }
  }
  return next;
}

function onFieldChange(fieldId: string, value: FormFieldValues[string]) {
  values.value = { ...values.value, [fieldId]: value };
}

function validate() {
  for (const field of fields.value) {
    if (field.type === "group") continue;
    if (!field.required) continue;
    if (field.type === "image_upload") {
      if (imageKeys.value.length === 0) return `请上传${field.label}`;
      continue;
    }
    const current = values.value[field.id];
    if (Array.isArray(current) && current.length === 0) {
      return `请选择${field.label}`;
    }
    if (
      current === undefined ||
      current === null ||
      (typeof current === "string" && !current.trim())
    ) {
      return `请填写${field.label}`;
    }
  }
  return "";
}

async function load() {
  if (!openid.value || !id.value) return;
  loading.value = true;
  error.value = "";
  try {
    detail.value = await apiRequest<WorkerSubmissionDetail>(
      `/api/submissions/${encodeURIComponent(id.value)}?openid=${encodeURIComponent(openid.value)}`
    );
    mode.value = "view";
  } catch (e: any) {
    error.value = e?.message || "加载失败";
    detail.value = null;
  } finally {
    loading.value = false;
  }
}

function startEdit() {
  if (!detail.value?.canEdit) return;
  values.value = valuesFromSubmission(fields.value, detail.value.data);
  imageKeys.value = detail.value.images || [];
  mode.value = "edit";
}

async function handleEditSubmit() {
  if (!detail.value) return;
  const err = validate();
  if (err) {
    ElMessage.warning(err);
    return;
  }
  submitting.value = true;
  try {
    const payloadData: FormFieldValues = { ...values.value };
    const imageField = fields.value.find((f) => f.type === "image_upload");
    if (imageField) payloadData[imageField.id] = imageKeys.value;
    const submittedBy = extractSubmittedBy(
      fields.value,
      payloadData,
      sessionName.value
    );
    detail.value = await apiRequest<WorkerSubmissionDetail>(
      `/api/submissions/${detail.value.id}`,
      {
        method: "PUT",
        body: JSON.stringify({
          openid: openid.value,
          data: payloadData,
          images: imageKeys.value,
          submittedBy,
        }),
      }
    );
    mode.value = "view";
    ElMessage.success("修改成功");
  } catch (e: any) {
    ElMessage.error(e?.message || "修改失败");
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  const session = getStoredSession();
  if (!session || session.role !== "worker") {
    router.replace("/worker/login");
    return;
  }
  openid.value = session.openid;
  sessionName.value = session.name;
  load();
});

watch(id, () => load());
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.state {
  padding: 28px 16px;
  text-align: center;
  color: #8a8a8a;
}
.block {
  padding: 14px 16px;
}
.title {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
}
.meta {
  margin: 6px 0 0;
  font-size: 12px;
  color: #8a8a8a;
}
.section {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 500;
}
.amber {
  margin: 6px 0 0;
  font-size: 12px;
  color: #d97706;
}
.mi-press {
  width: 100%;
  height: 44px;
}
</style>
