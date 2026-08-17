import { fail, success } from "~~/server/utils/response";
import prisma from "~~/server/utils/prisma";
import type { FormFieldDefinition } from "~~/shared/types/form-fields";

export default defineEventHandler(async (event) => {
  try {
    const scene = decodeURIComponent(getRouterParam(event, "scene") || "");

    if (!scene) {
      setResponseStatus(event, 400);
      return fail("scene 不能为空");
    }

    // Prisma 模型名为 Point（单数），字段为 camelCase
    const point = await prisma.point.findFirst({
      where: {
        code: scene,
        deletedAt: null,
      },
      include: {
        template: true,
      },
    });

    if (!point || point.status !== "active" || !point.template) {
      return fail("二维码无效");
    }

    const templateFields = (
      Array.isArray(point.template.fields) ? point.template.fields : []
    ) as FormFieldDefinition[];

    return success(
      {
        pointName: point.name,
        templateFields,
        templateVersion: point.template.version,
      },
      "success"
    );
  } catch (error) {
    console.error("qrcode error:", error);
    setResponseStatus(event, 500);
    return fail("获取二维码信息失败");
  }
});
