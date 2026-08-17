import { fail, success } from "../../utils/response";
import { requireAdminUser } from "../../utils/admin";
import prisma from "../../utils/prisma";

/** GET /api/admin/templates?pointId=xxx */
export default defineEventHandler(async (event) => {
  try {
    const { error, user } = await requireAdminUser(event);
    if (error || !user) return error!;

    const query = getQuery(event);
    const pointId = String(query.pointId ?? "").trim();
    if (!pointId) {
      setResponseStatus(event, 400);
      return fail("pointId 不能为空");
    }

    const point = await prisma.point.findFirst({
      where: { id: pointId, deletedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        template: true,
      },
    });

    if (!point) {
      setResponseStatus(event, 404);
      return fail("点位不存在");
    }

    if (!point.template) {
      setResponseStatus(event, 404);
      return fail("点位尚未关联模板");
    }

    return success(
      {
        id: point.template.id,
        pointId: point.template.pointId,
        name: point.template.name,
        fields: point.template.fields,
        version: point.template.version,
        pointName: point.name,
        pointCode: point.code,
      },
      "success"
    );
  } catch (err) {
    console.error("admin templates GET error:", err);
    setResponseStatus(event, 500);
    return fail("获取模板失败");
  }
});
