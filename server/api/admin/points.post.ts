import type { PointStatus } from "@prisma/client";
import { fail, success } from "../../utils/response";
import { requireAdminUser } from "../../utils/admin";
import { createId } from "../../utils/id";
import { generatePointCode } from "../../utils/point-code";
import prisma from "../../utils/prisma";

export default defineEventHandler(async (event) => {
  try {
    const { error, user } = await requireAdminUser(event, { adminOnly: true });
    if (error || !user) return error!;

    const body = await readBody(event);
    const name = String(body?.name || "").trim();
    const description = String(body?.description || "").trim();
    const status: PointStatus =
      body?.status === "inactive" ? "inactive" : "active";

    if (!name) {
      setResponseStatus(event, 400);
      return fail("点位名称不能为空");
    }

    let code = generatePointCode();
    // 极端情况下避免 code 冲突
    for (let i = 0; i < 3; i++) {
      const exists = await prisma.point.findUnique({ where: { code } });
      if (!exists) break;
      code = generatePointCode();
    }

    const pointId = createId();
    const templateId = createId();

    const point = await prisma.point.create({
      data: {
        id: pointId,
        code,
        name,
        description: description || null,
        status,
        template: {
          create: {
            id: templateId,
            name: `${name}表单`,
            version: 1,
            fields: [],
          },
        },
      },
      include: {
        template: {
          select: { id: true, name: true, version: true },
        },
      },
    });

    await prisma.operationLog.create({
      data: {
        id: createId(),
        userId: user.id,
        pointId: point.id,
        action: "create_point",
        targetId: point.id,
        detail: { code: point.code, name: point.name },
      },
    });

    return success(point, "创建成功");
  } catch (err) {
    console.error("admin points POST error:", err);
    setResponseStatus(event, 500);
    return fail("创建点位失败");
  }
});
