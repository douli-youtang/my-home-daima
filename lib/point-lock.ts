import prisma from "@/lib/prisma";
import {
  getPointLockUntil,
  isWithinPointLockWindow,
} from "@/lib/submission-limits";
import type { SubmissionPolicy } from "@/lib/system-settings";
import { DEFAULT_SUBMISSION_POLICY } from "@/lib/system-settings";

export type ActivePointSubmission = Awaited<
  ReturnType<typeof findActiveSubmissionForPoint>
>;

/** 查找点位在占用窗口内的最近一条有效提交；占用关闭时返回 null */
export async function findActiveSubmissionForPoint(
  pointId: string,
  policy: SubmissionPolicy = DEFAULT_SUBMISSION_POLICY,
  now: Date = new Date()
) {
  if (policy.pointLockHours <= 0) return null;

  const since = new Date(
    now.getTime() - policy.pointLockHours * 60 * 60 * 1000
  );
  const record = await prisma.formSubmission.findFirst({
    where: {
      pointId,
      isDeleted: false,
      submittedAt: { gte: since },
    },
    include: {
      point: { select: { name: true, code: true } },
    },
    orderBy: { submittedAt: "desc" },
  });

  if (!record) return null;
  if (!isWithinPointLockWindow(record.submittedAt, policy, now)) return null;
  return record;
}

export function pointLockMeta(
  submittedAt: Date | string,
  policy: SubmissionPolicy = DEFAULT_SUBMISSION_POLICY
) {
  const until = getPointLockUntil(submittedAt, policy);
  return {
    lockedUntil: until ? until.toISOString() : null,
    pointLockHours: policy.pointLockHours,
  };
}
