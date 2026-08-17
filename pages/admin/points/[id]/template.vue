<template>
  <div>
    <div class="head">
      <div>
        <h1 class="mi-section-title">模板配置</h1>
        <p class="mi-muted">
          {{ pointName || "点位" }}
          <template v-if="pointCode"> · {{ pointCode }}</template>
          · 当前 v{{ version }}
          <span v-if="dirty" class="dirty"> · 未保存</span>
        </p>
      </div>
      <div class="actions">
        <el-button round @click="goBack">返回</el-button>
        <el-button round :disabled="loading || !!error" @click="openCreate('group')">
          添加分组
        </el-button>
        <el-button round :disabled="loading || !!error" @click="openCreate()">
          添加字段
        </el-button>
        <el-button
          type="primary"
          round
          :loading="saving"
          :disabled="loading || !!error"
          @click="handleSave"
        >
          保存模板
        </el-button>
      </div>
    </div>

    <div v-loading="loading" class="mi-card panel">
      <el-alert
        v-if="error"
        :title="error.includes('不存在') ? '点位不存在或已删除' : error"
        type="error"
        show-icon
        :closable="false"
      />

      <template v-else>
        <div class="hint">
          支持两级结构：先添加「分组」（如鼠药），再在分组下添加二级字段（如投放克数、剩余克数）。普通字段也可单独存在。
        </div>

        <div class="quick">
          <p class="label">快速添加一级</p>
          <div class="chips">
            <el-button
              v-for="t in topLevelTypes"
              :key="t"
              size="small"
              round
              @click="openCreate(t)"
            >
              + {{ FIELD_TYPE_LABELS[t] }}
            </el-button>
          </div>
        </div>

        <div class="fields">
          <p class="label">字段结构（{{ sortedFields.length }} 项）</p>

          <el-empty v-if="tree.length === 0" description="还没有字段">
            <el-button type="primary" @click="openCreate('group')">添加分组</el-button>
            <el-button @click="openCreate()">添加普通字段</el-button>
          </el-empty>

          <div v-else class="field-list">
            <div v-for="(node, topIndex) in tree" :key="node.field.id" class="field-block">
              <div class="field-card" :class="{ group: node.field.type === 'group' }">
                <div class="field-main">
                  <span class="idx">{{ topIndex + 1 }}</span>
                  <el-tag size="small" round>{{ FIELD_TYPE_LABELS[node.field.type] }}</el-tag>
                  <strong>{{ node.field.label }}</strong>
                  <span v-if="node.field.required" class="req">必填</span>
                </div>
                <div class="field-ops">
                  <el-button
                    link
                    :disabled="topIndex === 0"
                    @click="handleMove(node.field.id, 'up')"
                  >
                    上移
                  </el-button>
                  <el-button
                    link
                    :disabled="topIndex === tree.length - 1"
                    @click="handleMove(node.field.id, 'down')"
                  >
                    下移
                  </el-button>
                  <el-button
                    v-if="node.field.type === 'group'"
                    link
                    type="primary"
                    @click="openCreate('number', node.field.id, node.field.label)"
                  >
                    加子字段
                  </el-button>
                  <el-button link type="primary" @click="openEdit(node.field)">编辑</el-button>
                  <el-button link type="danger" @click="handleDelete(node.field)">删除</el-button>
                </div>
              </div>

              <div
                v-for="(child, childIndex) in node.children"
                :key="child.id"
                class="field-card nested"
              >
                <div class="field-main">
                  <span class="idx">{{ topIndex + 1 }}.{{ childIndex + 1 }}</span>
                  <el-tag size="small" round>{{ FIELD_TYPE_LABELS[child.type] }}</el-tag>
                  <strong>{{ child.label }}</strong>
                  <span v-if="child.required" class="req">必填</span>
                </div>
                <div class="field-ops">
                  <el-button
                    link
                    :disabled="childIndex === 0"
                    @click="handleMove(child.id, 'up')"
                  >
                    上移
                  </el-button>
                  <el-button
                    link
                    :disabled="childIndex === node.children.length - 1"
                    @click="handleMove(child.id, 'down')"
                  >
                    下移
                  </el-button>
                  <el-button link type="primary" @click="openEdit(child)">编辑</el-button>
                  <el-button link type="danger" @click="handleDelete(child)">删除</el-button>
                </div>
              </div>

              <div
                v-if="node.field.type === 'group' && node.children.length === 0"
                class="empty-child"
              >
                暂无二级字段，可点「加子字段」或快速添加：
                <div class="chips">
                  <el-button
                    v-for="t in quickChildTypes.slice(0, 4)"
                    :key="t"
                    size="small"
                    round
                    @click="openCreate(t, node.field.id, node.field.label)"
                  >
                    + {{ FIELD_TYPE_LABELS[t] }}
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <el-dialog
      v-model="fieldModalOpen"
      :title="fieldModalTitle"
      width="520px"
      destroy-on-close
    >
      <p v-if="parentLabel" class="mi-muted sub">归属分组：{{ parentLabel }}</p>
      <el-form label-position="top">
        <el-form-item :label="fieldForm.type === 'group' ? '分组名称' : '字段名称'" required>
          <el-input
            v-model="fieldForm.label"
            :placeholder="fieldForm.type === 'group' ? '如：鼠药' : '如：投放克数'"
          />
        </el-form-item>

        <el-form-item v-if="!isChild || fieldModalMode === 'create'" label="类型">
          <div class="type-grid">
            <button
              v-for="t in typeOptions"
              :key="t"
              type="button"
              class="type-btn"
              :class="{ active: fieldForm.type === t }"
              :disabled="fieldModalMode === 'edit' && editing?.type === 'group'"
              @click="fieldForm.type = t"
            >
              <span class="type-label">{{ FIELD_TYPE_LABELS[t] }}</span>
              <span class="type-hint">{{ TYPE_HINTS[t] || "" }}</span>
            </button>
          </div>
        </el-form-item>

        <el-form-item
          v-if="needsOptions"
          label="选项列表（每行一个）"
        >
          <el-input
            v-model="fieldForm.optionsText"
            type="textarea"
            :rows="4"
            placeholder="张工&#10;李工&#10;王工"
          />
        </el-form-item>

        <el-form-item v-if="fieldForm.type !== 'group'">
          <el-checkbox v-model="fieldForm.required">必填项（未填写不可提交）</el-checkbox>
        </el-form-item>
        <p v-else class="mi-muted">
          分组本身不填写内容，用于归类下级字段。
        </p>
      </el-form>
      <template #footer>
        <el-button @click="fieldModalOpen = false">取消</el-button>
        <el-button type="primary" @click="handleFieldSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from "element-plus";
import {
  ALLOWED_FIELD_TYPES,
  CHILD_FIELD_TYPES,
  FIELD_TYPE_LABELS,
  buildFieldTree,
  flattenFieldOrders,
  generateFieldId,
  moveFieldOrder,
  optionsToText,
  parseOptionsText,
  removeFieldWithChildren,
  validateFields,
} from "~/lib/field-utils";
import type { FieldType, FormFieldDefinition } from "~/lib/types/form-fields";

definePageMeta({ layout: "admin", middleware: "admin" });

const TYPE_HINTS: Partial<Record<FieldType, string>> = {
  text: "单行文字",
  number: "仅数字",
  textarea: "多行文字",
  select: "下拉单选",
  multi_select_with_custom: "可多选，可自定义",
  image_upload: "拍照/上传图片",
  date: "选择日期",
  group: "一级标题，包含二级字段",
};

const route = useRoute();
const router = useRouter();
const { adminRequest } = useApi();

const pointId = computed(() => String(route.params.id || ""));
const pointName = ref("");
const pointCode = ref("");
const version = ref(1);
const fields = ref<FormFieldDefinition[]>([]);
const baseline = ref("");
const loading = ref(false);
const saving = ref(false);
const error = ref("");

const fieldModalOpen = ref(false);
const fieldModalMode = ref<"create" | "edit">("create");
const editing = ref<FormFieldDefinition | null>(null);
const presetType = ref<FieldType | null>(null);
const parentId = ref<string | null>(null);
const parentLabel = ref("");
const fieldForm = reactive({
  label: "",
  type: "text" as FieldType,
  optionsText: "",
  required: true,
});

const topLevelTypes = ALLOWED_FIELD_TYPES;
const quickChildTypes = CHILD_FIELD_TYPES;

const tree = computed(() => buildFieldTree(fields.value));
const sortedFields = computed(() => flattenFieldOrders(fields.value));
const dirty = computed(() => {
  if (!baseline.value) return false;
  return JSON.stringify(sortedFields.value) !== baseline.value;
});

const isChild = computed(() => Boolean(parentId.value || editing.value?.parentId));
const typeOptions = computed(() =>
  isChild.value ? CHILD_FIELD_TYPES : ALLOWED_FIELD_TYPES
);
const needsOptions = computed(
  () =>
    fieldForm.type === "select" || fieldForm.type === "multi_select_with_custom"
);
const fieldModalTitle = computed(() => {
  if (fieldModalMode.value === "create") {
    if (isChild.value) return "添加二级字段";
    if (fieldForm.type === "group" || presetType.value === "group") return "添加分组";
    return "添加字段";
  }
  return fieldForm.type === "group" ? "编辑分组" : "编辑字段";
});

onMounted(() => load());
watch(pointId, () => load());

async function load() {
  if (!pointId.value) return;
  loading.value = true;
  error.value = "";
  try {
    const data = await adminRequest<{
      pointName: string;
      pointCode: string;
      version: number;
      fields: FormFieldDefinition[];
    }>(`/api/admin/templates?pointId=${encodeURIComponent(pointId.value)}`);
    const parsed = validateFields(data.fields);
    const next = parsed.ok ? parsed.fields : [];
    pointName.value = data.pointName;
    pointCode.value = data.pointCode;
    version.value = data.version;
    fields.value = next;
    baseline.value = JSON.stringify(next);
  } catch (e: any) {
    error.value = e?.message || "加载失败";
    fields.value = [];
    baseline.value = "";
  } finally {
    loading.value = false;
  }
}

function openCreate(type?: FieldType, groupId?: string, groupLabel?: string) {
  fieldModalMode.value = "create";
  editing.value = null;
  presetType.value = type || null;
  parentId.value = groupId || null;
  parentLabel.value = groupLabel || "";
  fieldForm.label = "";
  fieldForm.type = type || (groupId ? "number" : "text");
  fieldForm.optionsText = "";
  fieldForm.required = type !== "group";
  fieldModalOpen.value = true;
}

function openEdit(field: FormFieldDefinition) {
  fieldModalMode.value = "edit";
  editing.value = field;
  presetType.value = null;
  parentId.value = field.parentId || null;
  const parent = fields.value.find((f) => f.id === field.parentId);
  parentLabel.value = parent?.label || "";
  fieldForm.label = field.label;
  fieldForm.type = field.type;
  fieldForm.optionsText = optionsToText(field.options);
  fieldForm.required = field.type === "group" ? false : Boolean(field.required);
  fieldModalOpen.value = true;
}

function handleFieldSubmit() {
  const trimmed = fieldForm.label.trim();
  if (!trimmed) {
    ElMessage.warning(fieldForm.type === "group" ? "请填写分组名称" : "请填写字段名称");
    return;
  }

  const lockedParentId = parentId.value || editing.value?.parentId || null;

  if (fieldForm.type === "group") {
    const field: FormFieldDefinition = {
      id: editing.value?.id || generateFieldId(),
      label: trimmed,
      type: "group",
      required: false,
      order: editing.value?.order || 0,
      parentId: null,
    };
    applyField(field);
    return;
  }

  let options: string[] | undefined;
  if (needsOptions.value) {
    options = parseOptionsText(fieldForm.optionsText);
    if (options.length === 0) {
      ElMessage.warning("请至少填写一个选项（每行一个）");
      return;
    }
  }

  const field: FormFieldDefinition = {
    id: editing.value?.id || generateFieldId(),
    label: trimmed,
    type: fieldForm.type,
    required: fieldForm.required,
    order: editing.value?.order || 0,
    parentId: lockedParentId,
    ...(options ? { options } : {}),
    ...(fieldForm.type === "image_upload" ? { multiple: true } : {}),
  };
  applyField(field);
}

function applyField(field: FormFieldDefinition) {
  if (fieldModalMode.value === "create") {
    fields.value = flattenFieldOrders([...fields.value, field]);
  } else {
    fields.value = flattenFieldOrders(
      fields.value.map((item) =>
        item.id === field.id
          ? { ...field, order: item.order, parentId: item.parentId }
          : item
      )
    );
  }
  fieldModalOpen.value = false;
}

async function handleDelete(field: FormFieldDefinition) {
  const isGroup = field.type === "group";
  const childCount = fields.value.filter((f) => f.parentId === field.id).length;
  const msg = isGroup
    ? `确认删除分组「${field.label}」及其 ${childCount} 个二级字段？`
    : `确认删除字段「${field.label}」？`;
  try {
    await ElMessageBox.confirm(msg, isGroup ? "删除分组" : "删除字段", {
      type: "warning",
      confirmButtonText: "删除",
    });
  } catch {
    return;
  }
  fields.value = removeFieldWithChildren(fields.value, field.id);
}

function handleMove(fieldId: string, direction: "up" | "down") {
  fields.value = moveFieldOrder(fields.value, fieldId, direction);
}

async function handleSave() {
  if (!pointId.value) return;
  const validated = validateFields(sortedFields.value);
  if (!validated.ok) {
    ElMessage.error(validated.message);
    return;
  }
  saving.value = true;
  try {
    const result = await adminRequest<{ version: number }>("/api/admin/templates", {
      method: "PUT",
      body: JSON.stringify({ pointId: pointId.value, fields: validated.fields }),
    });
    version.value = result.version;
    fields.value = validated.fields;
    baseline.value = JSON.stringify(validated.fields);
    ElMessage.success(`已保存，版本更新为 v${result.version}`);
  } catch (e: any) {
    ElMessage.error(e?.message || "保存失败");
  } finally {
    saving.value = false;
  }
}

async function goBack() {
  if (dirty.value) {
    try {
      await ElMessageBox.confirm("有未保存的修改，确认离开？", "未保存的修改", {
        type: "warning",
        confirmButtonText: "离开",
      });
    } catch {
      return;
    }
  }
  router.push(`/admin/points/${pointId.value}`);
}
</script>

<style scoped>
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.dirty {
  color: var(--mi-orange);
  font-weight: 600;
}
.panel {
  padding: 18px 20px;
}
.hint {
  border-radius: 12px;
  background: var(--mi-orange-soft);
  color: var(--mi-orange-pressed);
  font-size: 12px;
  line-height: 1.6;
  padding: 10px 12px;
  margin-bottom: 16px;
}
.quick,
.fields {
  margin-bottom: 16px;
}
.label {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--mi-ink-3);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.field-list {
  display: grid;
  gap: 10px;
}
.field-block {
  display: grid;
  gap: 8px;
}
.field-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid #eee;
  background: #fff;
}
.field-card.group {
  background: #fafafa;
  border-color: #e5e5e5;
}
.field-card.nested {
  margin-left: 24px;
  background: #fcfcfc;
}
.field-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.idx {
  font-size: 12px;
  color: var(--mi-ink-3);
  min-width: 28px;
}
.req {
  font-size: 11px;
  color: #e6a23c;
}
.field-ops {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}
.empty-child {
  margin-left: 24px;
  border: 1px dashed #ddd;
  border-radius: 12px;
  padding: 12px;
  font-size: 12px;
  color: var(--mi-ink-3);
}
.sub {
  margin: 0 0 12px;
}
.type-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
@media (min-width: 640px) {
  .type-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
.type-btn {
  text-align: left;
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  background: #fff;
  padding: 10px 12px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.type-btn.active {
  border-color: var(--mi-orange);
  background: var(--mi-orange-soft);
  box-shadow: 0 0 0 1px var(--mi-orange);
}
.type-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.type-label {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  color: var(--mi-ink);
}
.type-hint {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--mi-ink-3);
}
</style>
