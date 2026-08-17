import { fail, success } from "../../../../utils/response";
import { requireAdminUser } from "../../../../utils/admin";
import prisma from "../../../../utils/prisma";
import type { FormFieldValues } from "../../../../utils/types/types/form-fields";

/** GET /api/admin/records/[id]/edits 后台查看修改记录 */
export default defineEventHandler(async (event) => {
  try {
    const { error, user } = await requireAdminUser(event);
    if (error || !user) return error!;

    const id = getRouterParam(event, "id")!;
    const record = await prisma.formSubmission.findUnique({
      where: { id },
      select: {
        id: true,
        editCount: true,
        submittedAt: true,
        submittedBy: true,
        data: true,
        images: true,
        fieldsSnapshot: true,
      },
    });

    if (!record) {
      setResponseStatus(event, 404);
      return fail("记录不存在");
    }

    const edits = await prisma.formSubmissionEdit.findMany({
      where: { submissionId: id },
      orderBy: { sequence: "asc" },
    });

    return success({
      submissionId: id,
      editCount: record.editCount,
      submittedAt: record.submittedAt,
      currentSubmittedBy: record.submittedBy,
      fieldsSnapshot: record.fieldsSnapshot,
      /** 原始提交：取第一次修改的 before，若无修改则为当前数据 */
      original: edits.length
        ? {
            data: edits[0].beforeData as FormFieldValues,
            images: Array.isArray(edits[0].beforeImages)
              ? (edits[0].beforeImages as string[])
              : [],
            submittedBy: edits[0].beforeSubmittedBy,
            at: record.submittedAt,
          }
        : {
            data: (record.data || {}) as FormFieldValues,
            images: Array.isArray(record.images)
              ? (record.images as string[])
              : [],
            submittedBy: record.submittedBy,
            at: record.submittedAt,
          },
      edits: edits.map((item) => ({
        id: item.id,
        sequence: item.sequence,
        beforeData: item.beforeData as FormFieldValues,
        afterData: item.afterData as FormFieldValues,
        beforeImages: Array.isArray(item.beforeImages)
          ? (item.beforeImages as string[])
          : [],
        afterImages: Array.isArray(item.afterImages)
          ? (item.afterImages as string[])
          : [],
        beforeSubmittedBy: item.beforeSubmittedBy,
        afterSubmittedBy: item.afterSubmittedBy,
        editedByName: item.editedByName,
        editedAt: item.editedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("admin record edits error:", err);
    setResponseStatus(event, 500);
    return fail("获取修改记录失败");
  }
});
