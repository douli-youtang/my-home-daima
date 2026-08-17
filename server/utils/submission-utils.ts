import type { FormFieldDefinition, FormFieldValues } from "../../shared/types/form-fields";

/**
 * 校验提交 data 相对模板必填项是否完整
 */
export function validateSubmissionData(
  fields: FormFieldDefinition[],
  data: FormFieldValues,
  images: string[]
): string | null {
  const sorted = [...fields].sort((a, b) => a.order - b.order);

  for (const field of sorted) {
    if (field.type === "group") continue;
    if (!field.required) continue;

    if (field.type === "image_upload") {
      if (!images.length) {
        return `请上传${field.label}`;
      }
      continue;
    }

    const value = data[field.id];
    if (Array.isArray(value)) {
      if (value.length === 0) return `请填写${field.label}`;
      continue;
    }
    if (value === undefined || value === null || String(value).trim() === "") {
      return `请填写${field.label}`;
    }
  }

  return null;
}

/**
 * 从表单值中提取提交人名称（优先 multi_select / 文本类操作人字段）
 */
export function extractSubmittedBy(
  fields: FormFieldDefinition[],
  data: FormFieldValues,
  fallback?: string
): string {
  const sorted = [...fields].sort((a, b) => a.order - b.order);
  const operatorField =
    sorted.find((f) => f.type === "multi_select_with_custom") ||
    sorted.find((f) => f.label.includes("操作人") || f.label.includes("姓名"));

  if (operatorField) {
    const value = data[operatorField.id];
    if (Array.isArray(value) && value.length > 0) {
      return value.map(String).join("、");
    }
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return (fallback || "").trim();
}

function formatSummaryText(value: unknown, maxLen: number): string | null {
  if (value === undefined || value === null) return null;
  const text = Array.isArray(value)
    ? value.map(String).join("、").trim()
    : String(value).trim();
  if (!text) return null;
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

function isRemarkField(field: FormFieldDefinition): boolean {
  const label = (field.label || "").trim();
  return (
    label === "备注" ||
    label.endsWith("备注") ||
    label.includes("备注") ||
    /remark/i.test(field.id)
  );
}

/**
 * 内容摘要：优先取表单「备注」字段；无备注或为空时返回 "-"
 */
export function summarizeSubmissionData(
  fields: FormFieldDefinition[],
  data: FormFieldValues,
  maxLen = 40
): string {
  const sorted = [...fields].sort((a, b) => a.order - b.order);

  const remarkFields = sorted.filter(
    (field) =>
      field.type !== "group" &&
      field.type !== "image_upload" &&
      isRemarkField(field)
  );

  // 优先：label 精确为「备注」的 textarea / text
  const preferred =
    remarkFields.find((f) => (f.label || "").trim() === "备注") ||
    remarkFields.find((f) => f.type === "textarea") ||
    remarkFields[0];

  if (preferred) {
    return formatSummaryText(data[preferred.id], maxLen) || "-";
  }

  // 无备注字段时兜底：取第一个非空文本值（兼容旧模板）
  for (const field of sorted) {
    if (
      field.type === "group" ||
      field.type === "image_upload" ||
      field.type === "multi_select_with_custom"
    ) {
      continue;
    }
    const text = formatSummaryText(data[field.id], maxLen);
    if (text) return text;
  }

  return "-";
}

export function formatFieldDisplayValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "-";
  if (Array.isArray(value)) return value.length ? value.join("、") : "-";
  return String(value);
}
