<template>
  <div class="page">
    <div v-if="bootLoading" class="mi-card state">加载点位信息...</div>
    <div v-else-if="bootError" class="mi-card state">
      <p>{{ bootError }}</p>
      <el-button type="primary" @click="loadPoint">重试</el-button>
    </div>

    <template v-else>
      <div class="mi-card hello">
        {{ session?.name }}
        <span class="role">（作业人员）</span>
        <el-button text type="primary" class="link" @click="router.push('/worker')">
          我的工单
        </el-button>
      </div>

      <div v-if="checkingActive" class="mi-card state">检查点位填报状态...</div>

      <!-- 已有填报：本人可看/改，非本人锁定 -->
      <template v-else-if="mode === 'success' && result">
        <div class="mi-card block">
          <p :class="justSubmitted ? 'ok' : 'brand'">
            {{
              justSubmitted
                ? "提交成功"
                : isOwner
                  ? "该点位已有填报"
                  : "该点位已被占用（锁定）"
            }}
          </p>
          <p class="title">{{ result.pointName || pointName || "填报结果" }}</p>
          <p class="meta">提交人：{{ result.submitterName || "-" }}</p>
          <p class="meta">
            填写人：{{ result.submittedBy }} ·
            {{ formatTime(result.submittedAt) }}
          </p>
          <p v-if="!isOwner" class="lock">
            {{
              lockHours && lockHours > 0
                ? `该点位 ${lockHours} 小时内已有填报，暂不可再次提交`
                : pointLockHint
            }}
          </p>
          <p v-else-if="result.canEdit" class="amber">
            {{ editHint }}
            <template v-if="result.editableUntil">
              （截止 {{ formatTime(result.editableUntil) }}）
            </template>
          </p>
          <p v-else class="meta">{{ result.editLockMessage || "当前不可修改" }}</p>
        </div>

        <div class="mi-card block">
          <p class="section">提交内容</p>
          <SubmissionDataView
            :fields="displayFields"
            :data="result.data"
            :images="result.images"
          />
        </div>

        <el-button
          v-if="isOwner && result.canEdit"
          class="mi-press"
          @click="startEdit"
        >
          修改（剩余 {{ result.remainingEdits }} 次）
        </el-button>

        <el-button type="primary" class="mi-press" @click="router.push('/worker')">
          {{ justSubmitted ? "已成功提交，退出表单" : "返回我的工单" }}
        </el-button>
      </template>

      <!-- 填写 / 修改 -->
      <template v-else>
        <div class="mi-card block">
          <p class="meta">{{ mode === "edit" ? "修改填报" : "当前点位" }}</p>
          <p class="title">{{ pointName || "填写工单" }}</p>
          <p v-if="mode === 'edit' && result" class="amber">
            第 {{ result.editCount + 1 }} 次修改，共可修改 {{ result.maxEdits }} 次
          </p>
          <p v-else class="meta">{{ pointLockHint }}</p>
        </div>

        <div class="mi-card block">
          <el-empty
            v-if="!fieldsForForm.length"
            description="暂无表单字段"
            :image-size="64"
          />
          <DynamicFormFields
            v-else
            :fields="fieldsForForm"
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
          :disabled="!fieldsForForm.length"
          @click="mode === 'edit' ? handleEditSubmit() : handleSubmit()"
        >
          {{ mode === "edit" ? "保存修改" : "提交表单" }}
        </el-button>
        <el-button v-if="mode === 'edit'" @click="mode = 'success'">取消修改</el-button>
      </template>
    </template>

    <ChangePasswordDialog
      v-if="session"
      v-model="pwdOpen"
      forced
      :openid="session.openid"
      :default-account="session.name"
      @success="onPwdSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import type {
  ActiveSubmissionResult,
  SubmissionPolicy,
  WorkerSubmissionDetail,
} from "~/lib/client-api";
import { extractSubmittedBy } from "~/lib/submission-utils";
import type { FormFieldDefinition, FormFieldValues } from "~/lib/types";
import type { AppSession } from "~/composables/useSession";
import { DEFAULT_SCENE } from "~/composables/useSession";

definePageMeta({
  layout: "worker",
  title: "填写工单",
});

type Mode = "form" | "success" | "edit";
type ActiveDetail = WorkerSubmissionDetail & {
  isOwner?: boolean;
  lockedUntil?: string | null;
};

const route = useRoute();
const router = useRouter();
const {
  getStoredSession,
  setMustChangePasswordFlag,
  isAdminRole,
} = useSession();

const scene = computed(() => {
  const q = route.query.scene;
  return typeof q === "string" && q.trim() ? q.trim() : DEFAULT_SCENE;
});

const session = ref<AppSession | null>(null);
const pointName = ref("");
const templateFields = ref<FormFieldDefinition[]>([]);
const bootLoading = ref(true);
const bootError = ref("");
const checkingActive = ref(true);
const mode = ref<Mode>("form");
const values = ref<FormFieldValues>({});
const imageKeys = ref<string[]>([]);
const submitting = ref(false);
const justSubmitted = ref(false);
const result = ref<ActiveDetail | null>(null);
const policy = ref<SubmissionPolicy | null>(null);
const pointLockHint = ref("同一二维码占用窗口内仅可提交一次");
const pwdOpen = ref(false);

const sortedFields = computed(() =>
  [...templateFields.value].sort((a, b) => a.order - b.order)
);
const displayFields = computed(() =>
  result.value?.fieldsSnapshot?.length
    ? [...result.value.fieldsSnapshot].sort((a, b) => a.order - b.order)
    : sortedFields.value
);
const fieldsForForm = computed(() =>
  mode.value === "edit" ? displayFields.value : sortedFields.value
);
const isOwner = computed(() => result.value?.isOwner !== false);
const lockHours = computed(
  () => result.value?.pointLockHours ?? policy.value?.pointLockHours
);
const editHint = computed(() => {
  const r = result.value;
  if (!r) return "";
  const editHours = r.editWindowHours ?? policy.value?.editWindowHours;
  if (editHours === undefined) return `可修改，剩余 ${r.remainingEdits} 次`;
  if (editHours <= 0) return `可修改，剩余 ${r.remainingEdits} 次（不限时间）`;
  return `提交后 ${editHours} 小时内可修改，剩余 ${r.remainingEdits} 次`;
});

function formatTime(value: string) {
  try {
    return new Date(value).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return value;
  }
}

function createInitialValues(fields: FormFieldDefinition[]): FormFieldValues {
  const next: FormFieldValues = {};
  for (const field of fields) {
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
  fields: FormFieldDefinition[],
  data: FormFieldValues
): FormFieldValues {
  const next = createInitialValues(fields);
  for (const field of fields) {
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
  for (const field of fieldsForForm.value) {
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

function buildPayload() {
  const payloadData: FormFieldValues = { ...values.value };
  const imageField = fieldsForForm.value.find((f) => f.type === "image_upload");
  if (imageField) payloadData[imageField.id] = imageKeys.value;
  const submittedBy = extractSubmittedBy(
    fieldsForForm.value,
    payloadData,
    session.value?.name
  );
  return { payloadData, submittedBy };
}

async function loadPoint() {
  bootLoading.value = true;
  bootError.value = "";
  try {
    const qrcode = await apiRequest<{
      pointName: string;
      templateFields: FormFieldDefinition[];
      templateVersion: number;
    }>(`/api/qrcode/${encodeURIComponent(scene.value)}`);
    pointName.value = qrcode.pointName;
    templateFields.value = qrcode.templateFields || [];
    values.value = createInitialValues(templateFields.value);
  } catch (e: any) {
    bootError.value = e?.message || "二维码无效或点位不存在";
  } finally {
    bootLoading.value = false;
  }
}

async function loadActive() {
  if (!session.value) return;
  checkingActive.value = true;
  try {
    const data = await apiRequest<ActiveSubmissionResult>(
      `/api/submissions/active?scene=${encodeURIComponent(scene.value)}&openid=${encodeURIComponent(session.value.openid)}`
    );
    if (data.policy) policy.value = data.policy;
    if (data.pointLockHint) pointLockHint.value = data.pointLockHint;
    if (data.active && data.submission) {
      result.value = data.submission as ActiveDetail;
      mode.value = "success";
      justSubmitted.value = false;
    } else {
      result.value = null;
      mode.value = "form";
      justSubmitted.value = false;
    }
  } catch (e: any) {
    ElMessage.error(e?.message || "加载失败");
    result.value = null;
    mode.value = "form";
  } finally {
    checkingActive.value = false;
  }
}

function startEdit() {
  if (!result.value?.canEdit || !isOwner.value) return;
  const fields = displayFields.value;
  values.value = valuesFromSubmission(fields, result.value.data);
  imageKeys.value = result.value.images || [];
  mode.value = "edit";
}

async function handleSubmit() {
  if (!session.value) return;
  const err = validate();
  if (err) {
    ElMessage.warning(err);
    return;
  }
  submitting.value = true;
  try {
    const { payloadData, submittedBy } = buildPayload();
    const data = await apiRequest<ActiveDetail>("/api/submissions", {
      method: "POST",
      body: JSON.stringify({
        scene: scene.value,
        openid: session.value.openid,
        data: payloadData,
        images: imageKeys.value,
        submittedBy,
      }),
    });
    result.value = { ...data, isOwner: true };
    mode.value = "success";
    justSubmitted.value = true;
    ElMessage.success("提交成功");
  } catch (e: any) {
    if (e?.message) {
      try {
        const active = await apiRequest<ActiveSubmissionResult>(
          `/api/submissions/active?scene=${encodeURIComponent(scene.value)}&openid=${encodeURIComponent(session.value.openid)}`
        );
        if (active.active && active.submission) {
          result.value = active.submission as ActiveDetail;
          mode.value = "success";
          justSubmitted.value = false;
        }
      } catch {
        /* ignore */
      }
    }
    ElMessage.error(e?.message || "提交失败");
  } finally {
    submitting.value = false;
  }
}

async function handleEditSubmit() {
  if (!session.value || !result.value) return;
  const err = validate();
  if (err) {
    ElMessage.warning(err);
    return;
  }
  submitting.value = true;
  try {
    const { payloadData, submittedBy } = buildPayload();
    const data = await apiRequest<ActiveDetail>(
      `/api/submissions/${result.value.id}`,
      {
        method: "PUT",
        body: JSON.stringify({
          openid: session.value.openid,
          data: payloadData,
          images: imageKeys.value,
          submittedBy,
        }),
      }
    );
    result.value = { ...data, isOwner: true };
    mode.value = "success";
    justSubmitted.value = false;
    ElMessage.success("修改成功");
  } catch (e: any) {
    ElMessage.error(e?.message || "修改失败");
  } finally {
    submitting.value = false;
  }
}

function onPwdSuccess() {
  setMustChangePasswordFlag(false);
  if (session.value) {
    session.value = { ...session.value, mustChangePassword: false };
  }
  pwdOpen.value = false;
}

watch(
  () => scene.value,
  async () => {
    await loadPoint();
    if (session.value?.role === "worker") await loadActive();
  }
);

onMounted(async () => {
  const s = getStoredSession();
  if (!s || s.role === "guest") {
    router.replace(
      `/worker/login?scene=${encodeURIComponent(scene.value)}`
    );
    return;
  }
  if (isAdminRole(s.role)) {
    router.replace(
      `/viewer?point=${encodeURIComponent(scene.value)}`
    );
    return;
  }
  if (s.role !== "worker") {
    router.replace(`/worker/login?scene=${encodeURIComponent(scene.value)}`);
    return;
  }
  session.value = s;
  if (s.mustChangePassword) pwdOpen.value = true;
  await loadPoint();
  if (!bootError.value) await loadActive();
});
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
.hello {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 16px;
  font-size: 14px;
  color: #4d4d4d;
}
.role {
  font-size: 12px;
  color: #8a8a8a;
}
.link {
  margin-left: auto;
}
.block {
  padding: 14px 16px;
}
.title {
  margin: 4px 0 0;
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
.ok {
  margin: 0;
  color: #16a34a;
  font-size: 14px;
  font-weight: 500;
}
.brand {
  margin: 0;
  color: #ff6900;
  font-size: 14px;
  font-weight: 500;
}
.amber {
  margin: 6px 0 0;
  font-size: 12px;
  color: #d97706;
}
.lock {
  margin: 8px 0 0;
  padding: 8px 10px;
  border-radius: 10px;
  background: #fff7ed;
  color: #c2410c;
  font-size: 12px;
}
.mi-press {
  width: 100%;
  height: 44px;
}
</style>
