import { fail, success } from "../../utils/response";
import prisma from "../../utils/prisma";
import { summarizeSubmissionData } from "../../utils/submission-utils";
import { resolveSubmitterNames } from "../../utils/submitter-names";
import type {
  FormFieldDefinition,
  FormFieldValues,
} from "../../utils/types/types/form-fields";

/**
 * GET /api/records/[scene]?openid=xxx
 * 管理员 / 维护员：查看某点位的历史填写记录
 */
export default defineEventHandler(async (event) => {
  try {
    const scene = decodeURIComponent(getRouterParam(event, "scene") || "").trim();
    const query = getQuery(event);
    const openid = String(query.openid || "").trim();

    if (!scene) {
      setResponseStatus(event, 400);
      return fail("scene 不能为空");
    }
    if (!openid) {
      setResponseStatus(event, 400);
      return fail("openid 不能为空");
    }

    const user = await prisma.user.findUnique({ where: { openid } });
    if (!user || user.status !== "active") {
      setResponseStatus(event, 403);
      return fail("用户未授权");
    }
    if (user.role !== "admin" && user.role !== "maintainer") {
      setResponseStatus(event, 403);
      return fail("无权限访问");
    }

    const point = await prisma.point.findFirst({
      where: { code: scene, deletedAt: null },
      select: { id: true, name: true, code: true },
    });
    if (!point) {
      setResponseStatus(event, 404);
      return fail("二维码无效或点位不存在");
    }

    const rows = await prisma.formSubmission.findMany({
      where: {
        pointId: point.id,
        isDeleted: false,
      },
      orderBy: { submittedAt: "desc" },
      take: 100,
    });

    const nameMap = await resolveSubmitterNames(
      rows.map((r) => r.submitterOpenid)
    );

    const data = rows.map((row) => {
      const fields = (
        Array.isArray(row.fieldsSnapshot) ? row.fieldsSnapshot : []
      ) as FormFieldDefinition[];
      const formData = (row.data || {}) as FormFieldValues;
      const images = Array.isArray(row.images)
        ? (row.images as string[])
        : [];

      return {
        id: row.id,
        scene: point.code,
        openid: user.openid,
        name: row.submittedBy,
        submitterName: nameMap.get(row.submitterOpenid) || "",
        status: "正常",
        remark: summarizeSubmissionData(fields, formData),
        imageKeys: images,
        createdAt: row.submittedAt.toISOString(),
        isDeleted: row.isDeleted,
        pointName: point.name,
        data: formData,
        fieldsSnapshot: fields,
      };
    });

    return success(
      {
        pointName: point.name,
        pointCode: point.code,
        list: data,
      },
      "success"
    );
  } catch (error) {
    console.error("records error:", error);
    setResponseStatus(event, 500);
    return fail("获取记录失败");
  }
});
