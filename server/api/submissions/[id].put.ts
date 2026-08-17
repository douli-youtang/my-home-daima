import { fail, success } from "../../../utils/response";
import { createId } from "../../../utils/id";
import prisma from "../../../utils/prisma";
import { toSubmissionDetail } from "../../../utils/submission-dto";
import {
  canEditSubmission,
  editLockMessage,
  getEditLockReason,
} from "../../../utils/submission-limits";
import {
  extractSubmittedBy,
  validateSubmissionData,
} from "../../../utils/submission-utils";
import { resolveSubmitterNames } from "../../../utils/submitter-names";
import { getSubmissionPolicy } from "../../../utils/system-settings";
import type {
  FormFieldDefinition,
  FormFieldValues,
} from "../../../utils/types/types/form-fields";

/**
 * PUT /api/submissions/[id]
 * 作业人员修改自己的提交
 */
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id")!;
    const body = await readBody(event);
    const openid = String(
      body?.openid || getHeader(event, "x-openid") || ""
    ).trim();
    const data = (body?.data || {}) as FormFieldValues;
    const images = Array.isArray(body?.images)
      ? body.images.map((item: unknown) => String(item)).filter(Boolean)
      : [];
    let submittedBy = String(body?.submittedBy || "").trim();

    if (!openid) {
      setResponseStatus(event, 401);
      return fail("用户未登录");
    }

    const user = await prisma.user.findUnique({ where: { openid } });
    if (!user || user.status !== "active" || user.role !== "worker") {
      setResponseStatus(event, 403);
      return fail("仅作业人员可修改");
    }

    const record = await prisma.formSubmission.findUnique({
      where: { id },
      include: { point: { select: { name: true, code: true } } },
    });

    if (!record || record.isDeleted) {
      setResponseStatus(event, 404);
      return fail("记录不存在");
    }
    if (record.submitterOpenid !== openid) {
      setResponseStatus(event, 403);
      return fail("只能修改自己提交的记录");
    }

    const policy = await getSubmissionPolicy();
    if (!canEditSubmission(record.editCount, record.submittedAt, policy)) {
      const reason = getEditLockReason(
        record.editCount,
        record.submittedAt,
        policy
      );
      return fail(editLockMessage(reason, policy) || "当前不可修改");
    }

    const fields = (
      Array.isArray(record.fieldsSnapshot) ? record.fieldsSnapshot : []
    ) as FormFieldDefinition[];

    if (!submittedBy) {
      submittedBy = extractSubmittedBy(fields, data, user.name);
    }
    if (!submittedBy) {
      return fail("提交人不能为空");
    }

    const missing = validateSubmissionData(fields, data, images);
    if (missing) {
      return fail(missing);
    }

    const beforeData = record.data;
    const beforeImages = record.images;
    const beforeSubmittedBy = record.submittedBy;
    const nextEditCount = record.editCount + 1;

    const [updated] = await prisma.$transaction([
      prisma.formSubmission.update({
        where: { id },
        data: {
          data,
          images,
          submittedBy,
          editCount: nextEditCount,
        },
        include: { point: { select: { name: true, code: true } } },
      }),
      prisma.formSubmissionEdit.create({
        data: {
          id: createId(),
          submissionId: id,
          sequence: nextEditCount,
          beforeData: JSON.parse(JSON.stringify(beforeData)),
          afterData: data,
          beforeImages: JSON.parse(JSON.stringify(beforeImages)),
          afterImages: images,
          beforeSubmittedBy,
          afterSubmittedBy: submittedBy,
          editedByOpenid: user.openid,
          editedByName: user.name,
        },
      }),
    ]);

    const submitterNames = await resolveSubmitterNames([
      updated.submitterOpenid,
    ]);

    return success(
      toSubmissionDetail(
        {
          ...updated,
          submitterName:
            submitterNames.get(updated.submitterOpenid) || user.name,
        },
        policy
      ),
      "修改成功"
    );
  } catch (error) {
    console.error("submissions PUT error:", error);
    setResponseStatus(event, 500);
    return fail("修改失败");
  }
});
