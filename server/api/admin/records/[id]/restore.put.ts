import { fail, success } from "../../../../utils/response";
import { requireAdminUser } from "../../../../utils/admin";
import { createId } from "../../../../utils/id";
import prisma from "../../../../utils/prisma";

/** PUT /api/admin/records/[id]/restore 仅管理员 */
export default defineEventHandler(async (event) => {
  try {
    const { error, user } = await requireAdminUser(event, { adminOnly: true });
    if (error || !user) return error!;

    const id = getRouterParam(event, "id")!;
    const existing = await prisma.formSubmission.findUnique({
      where: { id },
    });

    if (!existing) {
      setResponseStatus(event, 404);
      return fail("记录不存在");
    }

    if (!existing.isDeleted) {
      setResponseStatus(event, 400);
      return fail("记录未被删除");
    }

    await prisma.formSubmission.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedBy: null,
        deletedAt: null,
      },
    });

    await prisma.operationLog.create({
      data: {
        id: createId(),
        userId: user.id,
        pointId: existing.pointId,
        action: "restore_record",
        targetId: id,
        detail: {
          submittedBy: existing.submittedBy,
          submittedAt: existing.submittedAt,
        },
      },
    });

    return success({ id }, "恢复成功");
  } catch (err) {
    console.error("admin records restore error:", err);
    setResponseStatus(event, 500);
    return fail("恢复失败");
  }
});
