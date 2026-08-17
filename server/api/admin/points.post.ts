import type { PointStatus } from "@prisma/client";
import { fail, success } from "~~/server/utils/response";
import { requireAdminUser } from "~~/server/utils/admin";
import { createId } from "~~/server/utils/id";
import { formatPointCode, maxPointCodeSeq } from "~~/server/utils/point-code";
import prisma from "~~/server/utils/prisma";

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

    // 含已删除点位，避免编码复用冲突
    const existing = await prisma.point.findMany({ select: { code: true } });
    let seq = maxPointCodeSeq(existing.map((p) => p.code)) + 1;
    let code = formatPointCode(seq);
    for (let i = 0; i < 1000; i++) {
      const conflict = await prisma.point.findUnique({ where: { code } });
      if (!conflict) break;
      seq += 1;
      code = formatPointCode(seq);
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
