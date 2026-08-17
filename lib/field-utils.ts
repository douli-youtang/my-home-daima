export function generateFieldId(): string {
  const rand = Math.random().toString(36).slice(2, 6);
  return `fld_${rand}`;
}import type { FieldType, FormFieldDefinition } from "@/lib/types/form-fields";

export const ALLOWED_FIELD_TYPES: FieldType[] = [
  "text",
  "number",
  "textarea",
  "select",
  "multi_select_with_custom",
  "image_upload",
  "date",
  "group",
];

/** 可作为二级子字段的类型（不含 group） */
export const CHILD_FIELD_TYPES: FieldType[] = [
  "text",
  "number",
  "textarea",
  "select",
  "multi_select_with_custom",
  "image_upload",
  "date",
];

export const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "文本",
  number: "数字",
  textarea: "文本域",
  select: "单选下拉",
  multi_select_with_custom: "多选+自定义",
  image_upload: "图片上传",
  date: "日期",
  radio: "单选",
  group: "分组",
};

export const FIELD_TYPE_COLORS: Record<string, string> = {
  text: "bg-sky-50 text-sky-700",
  number: "bg-violet-50 text-violet-700",
  textarea: "bg-slate-100 text-slate-700",
  select: "bg-amber-50 text-amber-700",
  multi_select_with_custom: "bg-emerald-50 text-emerald-700",
  image_upload: "bg-rose-50 text-rose-700",
  date: "bg-indigo-50 text-indigo-700",
  radio: "bg-orange-50 text-orange-700",
  group: "bg-gray-800 text-white",
};

export type FieldTreeNode = {
  field: FormFieldDefinition;
  children: FormFieldDefinition[];
};

/** 字段 ID：fld_001、fld_002…（按已有字段递增，不用随机数） */
export function generateFieldId(
  existing: Array<{ id?: string }> | string[] = []
): string {
  let max = 0;
  for (const item of existing) {
    const id = typeof item === "string" ? item : String(item?.id || "");
    const m = /^fld_(\d+)$/i.exec(id);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `fld_${String(max + 1).padStart(3, "0")}`;
}

export function getDefaultFields(): FormFieldDefinition[] {
  const fields: FormFieldDefinition[] = [];
  const operatorId = generateFieldId(fields);
  fields.push({
    id: operatorId,
    label: "操作人",
    type: "multi_select_with_custom",
    options: ["张三", "李四"],
    required: true,
    order: 1,
  });
  const groupId = generateFieldId(fields);
  fields.push({
    id: groupId,
    label: "鼠药",
    type: "group",
    required: false,
    order: 2,
  });
  fields.push({
    id: generateFieldId(fields),
    label: "投放克数",
    type: "number",
    required: true,
    order: 3,
    parentId: groupId,
  });
  fields.push({
    id: generateFieldId(fields),
    label: "剩余克数",
    type: "number",
    required: true,
    order: 4,
    parentId: groupId,
  });
  return fields;
}

export function isGroupField(field: FormFieldDefinition): boolean {
  return field.type === "group";
}

export function isTopLevel(field: FormFieldDefinition): boolean {
  return !field.parentId;
}

export function getChildren(
  fields: FormFieldDefinition[],
  parentId: string
): FormFieldDefinition[] {
  return fields
    .filter((f) => f.parentId === parentId)
    .sort((a, b) => a.order - b.order);
}

/** 按树形结构展开：分组紧跟其子字段 */
export function buildFieldTree(fields: FormFieldDefinition[]): FieldTreeNode[] {
  const sorted = [...fields].sort((a, b) => a.order - b.order);
  const tops = sorted.filter((f) => !f.parentId);
  return tops.map((field) => ({
    field,
    children: isGroupField(field) ? getChildren(sorted, field.id) : [],
  }));
}

/** 按当前树节点顺序重新编号（不回退到旧 order） */
export function flattenTreeNodes(
  tree: FieldTreeNode[]
): FormFieldDefinition[] {
  const result: FormFieldDefinition[] = [];
  let order = 1;
  for (const node of tree) {
    result.push({
      ...node.field,
      order: order++,
      parentId: null,
    });
    if (isGroupField(node.field)) {
      for (const child of node.children) {
        result.push({
          ...child,
          order: order++,
          parentId: node.field.id,
          type: child.type === "group" ? "text" : child.type,
        });
      }
    }
  }
  return result;
}

/** 将树重新编号为连续 order（分组与子字段紧挨） */
export function flattenFieldOrders(
  fields: FormFieldDefinition[]
): FormFieldDefinition[] {
  return flattenTreeNodes(buildFieldTree(fields));
}

export type ValidateFieldsResult =
  | { ok: true; fields: FormFieldDefinition[] }
  | { ok: false; message: string };

export function validateFields(fields: unknown): ValidateFieldsResult {
  if (!Array.isArray(fields)) {
    return { ok: false, message: "fields 必须为数组" };
  }

  const normalized: FormFieldDefinition[] = [];
  const ids = new Set<string>();

  for (let i = 0; i < fields.length; i++) {
    const item = fields[i] as Partial<FormFieldDefinition> | null;
    if (!item || typeof item !== "object") {
      return { ok: false, message: `第 ${i + 1} 个字段格式无效` };
    }

    const id = String(item.id || "").trim();
    const label = String(item.label || "").trim();
    const type = item.type as FieldType;
    const order = Number(item.order);
    const parentId = item.parentId ? String(item.parentId).trim() : null;

    if (!id) {
      return { ok: false, message: `第 ${i + 1} 个字段缺少 id` };
    }
    if (ids.has(id)) {
      return { ok: false, message: `字段 id 重复：${id}` };
    }
    ids.add(id);

    if (!label) {
      return { ok: false, message: `第 ${i + 1} 个字段缺少 label` };
    }

    if (!ALLOWED_FIELD_TYPES.includes(type)) {
      return { ok: false, message: `字段「${label}」类型不支持：${type}` };
    }

    if (!Number.isFinite(order)) {
      return { ok: false, message: `字段「${label}」缺少有效 order` };
    }

    if (type === "group") {
      if (parentId) {
        return {
          ok: false,
          message: `分组「${label}」不能再归属其他分组（仅支持两级）`,
        };
      }
      normalized.push({
        id,
        label,
        type: "group",
        required: false,
        order,
        parentId: null,
      });
      continue;
    }

    if (typeof item.required !== "boolean") {
      return { ok: false, message: `字段「${label}」缺少 required` };
    }

    const needsOptions =
      type === "select" || type === "multi_select_with_custom";
    let options: string[] | undefined;

    if (needsOptions) {
      if (!Array.isArray(item.options)) {
        return {
          ok: false,
          message: `字段「${label}」需要 options 数组`,
        };
      }
      options = item.options.map((o) => String(o).trim()).filter(Boolean);
      if (options.length === 0) {
        return {
          ok: false,
          message: `字段「${label}」至少需要一个选项`,
        };
      }
    }

    normalized.push({
      id,
      label,
      type,
      required: item.required,
      order,
      parentId,
      ...(options ? { options } : {}),
      ...(type === "image_upload"
        ? { multiple: item.multiple !== false }
        : {}),
    });
  }

  // 校验 parentId 指向存在的 group
  const groupIds = new Set(
    normalized.filter((f) => f.type === "group").map((f) => f.id)
  );
  for (const field of normalized) {
    if (!field.parentId) continue;
    if (!groupIds.has(field.parentId)) {
      return {
        ok: false,
        message: `字段「${field.label}」的上级分组不存在`,
      };
    }
    if (field.type === "group") {
      return {
        ok: false,
        message: `字段「${field.label}」不能作为子字段（分组不可嵌套）`,
      };
    }
  }

  return { ok: true, fields: flattenFieldOrders(normalized) };
}

export function parseOptionsText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function optionsToText(options?: string[]): string {
  return (options || []).join("\n");
}

/**
 * 在同一层级内移动（顶级互移；同一分组下的子字段互移）
 * 注意：必须按交换后的树序重新编号，不能再按旧 order 排序，否则顺序会还原。
 */
export function moveFieldOrder(
  fields: FormFieldDefinition[],
  fieldId: string,
  direction: "up" | "down"
): FormFieldDefinition[] {
  const tree = buildFieldTree(fields);
  const field = fields.find((f) => f.id === fieldId);
  if (!field) return fields;

  if (!field.parentId) {
    const index = tree.findIndex((n) => n.field.id === fieldId);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= tree.length) {
      return flattenTreeNodes(tree);
    }
    const next = [...tree];
    const tmp = next[index];
    next[index] = next[target];
    next[target] = tmp;
    return flattenTreeNodes(next);
  }

  // 子字段：在兄弟间移动
  const parentIndex = tree.findIndex((n) => n.field.id === field.parentId);
  if (parentIndex < 0) return flattenTreeNodes(tree);

  const parentNode = tree[parentIndex];
  const siblings = [...parentNode.children];
  const index = siblings.findIndex((f) => f.id === fieldId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= siblings.length) {
    return flattenTreeNodes(tree);
  }
  const tmp = siblings[index];
  siblings[index] = siblings[target];
  siblings[target] = tmp;

  const next = tree.map((node, i) =>
    i === parentIndex ? { ...node, children: siblings } : node
  );
  return flattenTreeNodes(next);
}

/** 删除字段；若删除分组则一并删除其子字段 */
export function removeFieldWithChildren(
  fields: FormFieldDefinition[],
  fieldId: string
): FormFieldDefinition[] {
  const target = fields.find((f) => f.id === fieldId);
  if (!target) return fields;
  const next = fields.filter((f) => {
    if (f.id === fieldId) return false;
    if (target.type === "group" && f.parentId === fieldId) return false;
    return true;
  });
  return flattenFieldOrders(next);
}
