import { fail, success } from "../../../utils/response";
import { requireAdminUser } from "../../../utils/admin";
import { createId } from "../../../utils/id";
import prisma from "../../../utils/prisma";

/** DELETE /api/admin/records/[id] 软删除 */
export default defineEventHandler(async (event) => {
  try {
    const { error, user } = await requireAdminUser(event);
    if (error || !user) return error!;

    const id = getRouterParam(event, "id")!;
    const existing = await prisma.formSubmission.findUnique({
      where: { id },
    });

    if (!existing || existing.isDeleted) {
      setResponseStatus(event, 404);
      return fail("记录不存在或已删除");
    }

    await prisma.formSubmission.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedBy: user.id,
        deletedAt: new Date(),
      },
    });

    await prisma.operationLog.create({
      data: {
        id: createId(),
        userId: user.id,
        pointId: existing.pointId,
        action: "delete_record",
        targetId: id,
        detail: {
          submittedBy: existing.submittedBy,
          submittedAt: existing.submittedAt,
        },
      },
    });

    return success({ id }, "删除成功");
  } catch (err) {
    console.error("admin records DELETE error:", err);
    setResponseStatus(event, 500);
    return fail("删除失败");
  }
});
