import type { SubmissionPolicy } from "./system-settings";
import { DEFAULT_SUBMISSION_POLICY } from "./system-settings";

/** @deprecated 请优先使用系统设置中的策略；此处仅作兜底默认值 */
export const MAX_SUBMISSION_EDITS = DEFAULT_SUBMISSION_POLICY.maxSubmissionEdits;
/** @deprecated */
export const POINT_LOCK_WINDOW_MS =
  DEFAULT_SUBMISSION_POLICY.pointLockHours * 60 * 60 * 1000;
/** @deprecated */
export const EDIT_WINDOW_MS =
  DEFAULT_SUBMISSION_POLICY.editWindowHours * 60 * 60 * 1000;

export type { SubmissionPolicy };

function hoursToMs(hours: number): number {
  return Math.max(0, hours) * 60 * 60 * 1000;
}

function toDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

export function remainingEdits(
  editCount: number,
  policy: SubmissionPolicy = DEFAULT_SUBMISSION_POLICY
): number {
  return Math.max(0, policy.maxSubmissionEdits - editCount);
}

export function getEditableUntil(
  submittedAt: Date | string,
  policy: SubmissionPolicy = DEFAULT_SUBMISSION_POLICY
): Date | null {
  if (policy.editWindowHours <= 0) return null;
  return new Date(toDate(submittedAt).getTime() + hoursToMs(policy.editWindowHours));
}

export function getPointLockUntil(
  submittedAt: Date | string,
  policy: SubmissionPolicy = DEFAULT_SUBMISSION_POLICY
): Date | null {
  if (policy.pointLockHours <= 0) return null;
  return new Date(toDate(submittedAt).getTime() + hoursToMs(policy.pointLockHours));
}

export function isWithinEditWindow(
  submittedAt: Date | string,
  policy: SubmissionPolicy = DEFAULT_SUBMISSION_POLICY,
  now: Date = new Date()
): boolean {
  if (policy.editWindowHours <= 0) return true;
  const until = getEditableUntil(submittedAt, policy);
  return Boolean(until && now.getTime() <= until.getTime());
}

export function isWithinPointLockWindow(
  submittedAt: Date | string,
  policy: SubmissionPolicy = DEFAULT_SUBMISSION_POLICY,
  now: Date = new Date()
): boolean {
  if (policy.pointLockHours <= 0) return false;
  const until = getPointLockUntil(submittedAt, policy);
  return Boolean(until && now.getTime() <= until.getTime());
}

export type EditLockReason = "count" | "timeout" | null;

export function getEditLockReason(
  editCount: number,
  submittedAt: Date | string,
  policy: SubmissionPolicy = DEFAULT_SUBMISSION_POLICY,
  now: Date = new Date()
): EditLockReason {
  if (remainingEdits(editCount, policy) <= 0) return "count";
  if (!isWithinEditWindow(submittedAt, policy, now)) return "timeout";
  return null;
}

export function canEditSubmission(
  editCount: number,
  submittedAt: Date | string,
  policy: SubmissionPolicy = DEFAULT_SUBMISSION_POLICY,
  now: Date = new Date()
): boolean {
  return getEditLockReason(editCount, submittedAt, policy, now) === null;
}

export function editLockMessage(
  reason: EditLockReason,
  policy: SubmissionPolicy = DEFAULT_SUBMISSION_POLICY
): string {
  if (reason === "count") {
    if (policy.maxSubmissionEdits <= 0) return "当前不允许修改表单";
    return `已达到修改次数上限（最多 ${policy.maxSubmissionEdits} 次）`;
  }
  if (reason === "timeout") {
    return `已超过可修改时间（提交后 ${policy.editWindowHours} 小时内可改）`;
  }
  return "";
}

export function pointLockMessage(
  submitterName?: string,
  policy: SubmissionPolicy = DEFAULT_SUBMISSION_POLICY
): string {
  const who = submitterName?.trim() || "其他账号";
  if (policy.pointLockHours <= 0) {
    return `该二维码已由「${who}」填写`;
  }
  return `该二维码 ${policy.pointLockHours} 小时内已由「${who}」填写，暂不可再次提交`;
}

export function formatEditWindowHint(
  policy: SubmissionPolicy,
  remaining: number
): string {
  if (policy.editWindowHours <= 0) {
    return `可修改，剩余 ${remaining} 次（不限时间）`;
  }
  return `提交后 ${policy.editWindowHours} 小时内可修改，剩余 ${remaining} 次`;
}

export function formatPointLockHint(policy: SubmissionPolicy): string {
  if (policy.pointLockHours <= 0) {
    return "该二维码允许多次提交";
  }
  return `同一二维码 ${policy.pointLockHours} 小时内仅可提交一次`;
}
