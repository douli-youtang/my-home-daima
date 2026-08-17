import {
  canEditSubmission,
  editLockMessage,
  getEditLockReason,
  getEditableUntil,
  remainingEdits,
} from "./submission-limits";
import type { SubmissionPolicy } from "./system-settings";
import { DEFAULT_SUBMISSION_POLICY } from "./system-settings";
import type { FormFieldDefinition, FormFieldValues } from "../../shared/types/form-fields";

type SubmissionRow = {
  id: string;
  submittedBy: string;
  submitterOpenid: string;
  submitterType: string;
  /** 登录账号姓名（提交人），由接口侧解析后传入 */
  submitterName?: string | null;
  data: unknown;
  images: unknown;
  fieldsSnapshot: unknown;
  templateVersion: number;
  editCount: number;
  submittedAt: Date;
  point?: { name: string; code: string } | null;
};

export type SubmissionEditDTO = {
  id: string;
  sequence: number;
  beforeData: FormFieldValues;
  afterData: FormFieldValues;
  beforeImages: string[];
  afterImages: string[];
  beforeSubmittedBy: string;
  afterSubmittedBy: string;
  editedByName: string;
  editedAt: string;
};

export function toSubmissionDetail(
  row: SubmissionRow,
  policy: SubmissionPolicy = DEFAULT_SUBMISSION_POLICY
) {
  const images = Array.isArray(row.images) ? (row.images as string[]) : [];
  const fields = (
    Array.isArray(row.fieldsSnapshot) ? row.fieldsSnapshot : []
  ) as FormFieldDefinition[];
  const lockReason = getEditLockReason(row.editCount, row.submittedAt, policy);
  const editableUntil = getEditableUntil(row.submittedAt, policy);

  return {
    id: row.id,
    pointName: row.point?.name || "",
    pointCode: row.point?.code || "",
    submittedBy: row.submittedBy,
    submitterOpenid: row.submitterOpenid,
    /** 登录提交该工单的账号姓名 */
    submitterName: row.submitterName || "",
    submitterType: row.submitterType,
    data: (row.data || {}) as FormFieldValues,
    images,
    fieldsSnapshot: fields,
    templateVersion: row.templateVersion,
    editCount: row.editCount,
    maxEdits: policy.maxSubmissionEdits,
    remainingEdits: remainingEdits(row.editCount, policy),
    canEdit: canEditSubmission(row.editCount, row.submittedAt, policy),
    editLockReason: lockReason,
    editLockMessage: editLockMessage(lockReason, policy),
    editableUntil: editableUntil ? editableUntil.toISOString() : null,
    editWindowHours: policy.editWindowHours,
    pointLockHours: policy.pointLockHours,
    submittedAt: row.submittedAt.toISOString(),
  };
}

/** 列表项（不含完整字段快照，减轻体积） */
export function toSubmissionListItem(
  row: SubmissionRow,
  policy: SubmissionPolicy = DEFAULT_SUBMISSION_POLICY
) {
  const detail = toSubmissionDetail(row, policy);
  return {
    id: detail.id,
    pointName: detail.pointName,
    pointCode: detail.pointCode,
    submittedBy: detail.submittedBy,
    submitterName: detail.submitterName,
    editCount: detail.editCount,
    maxEdits: detail.maxEdits,
    remainingEdits: detail.remainingEdits,
    canEdit: detail.canEdit,
    editLockReason: detail.editLockReason,
    editLockMessage: detail.editLockMessage,
    editableUntil: detail.editableUntil,
    editWindowHours: detail.editWindowHours,
    pointLockHours: detail.pointLockHours,
    submittedAt: detail.submittedAt,
    imageCount: detail.images.length,
  };
}
