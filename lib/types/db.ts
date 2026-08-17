import type { FormFieldDefinition, FormFieldValues } from "./form-fields";

export type { FormFieldDefinition, FormFieldValues, FieldType } from "./form-fields";

/** operation_logs.action 常用取值 */
export type OperationAction =
  | "delete_record"
  | "restore_record"
  | "update_template"
  | "create_point"
  | "update_point"
  | "deactivate_point"
  | "activate_point"
  | "delete_point"
  | "create_user"
  | "update_user"
  | "delete_user"
  | "update_settings";

/** form_submissions.images JSON */
export type SubmissionImages = string[];
