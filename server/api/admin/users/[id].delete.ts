import { fail, success } from "../../../utils/response";
import { requireAdminUser } from "../../../utils/admin";
import { createId } from "../../../utils/id";
import prisma from "../../../utils/prisma";

export default defineEventHandler(async (event) => {
  try {
    const { error, user } = await requireAdminUser(event, { adminOnly: true });
    if (error || !user) return error!;

    const id = getRouterParam(event, "id")!;
    if (id === user.id) {
      setResponseStatus(event, 400);
      return fail("不可删除自己");
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      setResponseStatus(event, 404);
      return fail("用户不存在");
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status: "inactive" },
      select: {
        id: true,
        openid: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    await prisma.operationLog.create({
      data: {
        id: createId(),
        userId: user.id,
        action: "delete_user",
        targetId: id,
        detail: {
          openid: existing.openid,
          name: existing.name,
          role: existing.role,
        },
      },
    });

    return success(updated, "删除成功");
  } catch (err) {
    console.error("admin users DELETE error:", err);
    setResponseStatus(event, 500);
    return fail("删除用户失败");
  }
});
