/**
 * form_templates.fields JSON 字段类型定义
 */

export type FieldType =
  | "text"
  | "number"
  | "textarea"
  | "select"
  | "multi_select_with_custom"
  | "image_upload"
  | "date"
  | "radio"
  /** 一级分组：仅作标题容器，本身不采集值 */
  | "group";

export type FormFieldDefinition = {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  order: number;
  options?: string[];
  multiple?: boolean;
  /**
   * 所属一级分组 id。
   * 为空/undefined 表示顶级字段；仅二级字段可设置，且父级必须为 group。
   */
  parentId?: string | null;
};

/** 提交时的字段值：按 field.id 映射（group 不产生值） */
export type FormFieldValues = Record<
  string,
  string | number | string[] | null | undefined
>;
