import { fail, success } from "~~/server/utils/response";
import { requireAdminUser } from "~~/server/utils/admin";
import { validateFields } from "~~/server/utils/field-utils";
import { createId } from "~~/server/utils/id";
import prisma from "~~/server/utils/prisma";
import type { FormFieldDefinition } from "~~/shared/types/form-fields";

/** PUT /api/admin/templates */
export default defineEventHandler(async (event) => {
  try {
    const { error, user } = await requireAdminUser(event, { adminOnly: true });
    if (error || !user) return error!;

    const body = await readBody(event);
    const pointId = String(body?.pointId || "").trim();
    const fieldsInput = body?.fields;

    if (!pointId) {
      setResponseStatus(event, 400);
      return fail("pointId 不能为空");
    }

    const validated = validateFields(fieldsInput);
    if (!validated.ok) {
      setResponseStatus(event, 400);
      return fail(validated.message);
    }

    const point = await prisma.point.findFirst({
      where: { id: pointId, deletedAt: null },
      include: { template: true },
    });

    if (!point) {
      setResponseStatus(event, 404);
      return fail("点位不存在");
    }

    if (!point.template) {
      setResponseStatus(event, 404);
      return fail("点位尚未关联模板");
    }

    const beforeFields = point.template.fields as FormFieldDefinition[];
    const beforeVersion = point.template.version;

    const updated = await prisma.formTemplate.update({
      where: { id: point.template.id },
      data: {
        fields: validated.fields,
        version: { increment: 1 },
      },
    });

    await prisma.operationLog.create({
      data: {
        id: createId(),
        userId: user.id,
        pointId: point.id,
        action: "update_template",
        targetId: updated.id,
        detail: {
          pointId,
          beforeVersion,
          afterVersion: updated.version,
          beforeFields,
          afterFields: validated.fields,
        },
      },
    });

    return success({ version: updated.version }, "保存成功");
  } catch (err) {
    console.error("admin templates PUT error:", err);
    setResponseStatus(event, 500);
    return fail("保存模板失败");
  }
});
