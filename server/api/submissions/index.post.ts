import { fail, success } from "../../utils/response";
import { createId } from "../../utils/id";
import { findActiveSubmissionForPoint } from "../../utils/point-lock";
import prisma from "../../utils/prisma";
import { toSubmissionDetail } from "../../utils/submission-dto";
import {
  getPointLockUntil,
  pointLockMessage,
} from "../../utils/submission-limits";
import {
  extractSubmittedBy,
  validateSubmissionData,
} from "../../utils/submission-utils";
import { resolveSubmitterNames } from "../../utils/submitter-names";
import { getSubmissionPolicy } from "../../utils/system-settings";
import type {
  FormFieldDefinition,
  FormFieldValues,
} from "../../utils/types/types/form-fields";

/**
 * POST /api/submissions
 * Worker 提交表单
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const scene = String(body?.scene || "").trim();
    const openid = String(
      body?.openid || getHeader(event, "x-openid") || ""
    ).trim();
    const data = (body?.data || {}) as FormFieldValues;
    const images = Array.isArray(body?.images)
      ? body.images.map((item: unknown) => String(item)).filter(Boolean)
      : [];
    let submittedBy = String(body?.submittedBy || "").trim();

    if (!scene) {
      return fail("scene 不能为空");
    }
    if (!openid) {
      setResponseStatus(event, 401);
      return fail("用户未登录");
    }

    const user = await prisma.user.findUnique({ where: { openid } });
    if (!user || user.status !== "active") {
      setResponseStatus(event, 403);
      return fail("用户未授权");
    }
    if (user.role !== "worker") {
      setResponseStatus(event, 403);
      return fail("仅作业人员可提交表单");
    }

    const point = await prisma.point.findFirst({
      where: { code: scene, deletedAt: null },
      include: { template: true },
    });

    if (!point || point.status !== "active") {
      return fail("点位不存在或已失效");
    }
    if (!point.template) {
      return fail("模板不存在");
    }

    const policy = await getSubmissionPolicy();
    const active = await findActiveSubmissionForPoint(point.id, policy);
    if (active) {
      const nameMap = await resolveSubmitterNames([active.submitterOpenid]);
      const who =
        nameMap.get(active.submitterOpenid) ||
        active.submittedBy ||
        "其他账号";
      const lockedUntil = getPointLockUntil(active.submittedAt, policy);
      return fail(pointLockMessage(who, policy), 1, {
        activeSubmissionId: active.id,
        lockedUntil: lockedUntil ? lockedUntil.toISOString() : null,
      });
    }

    const fields = (
      Array.isArray(point.template.fields) ? point.template.fields : []
    ) as FormFieldDefinition[];

    if (!submittedBy) {
      submittedBy = extractSubmittedBy(fields, data, user.name);
    }
    if (!submittedBy) {
      return fail("提交人不能为空");
    }

    const missing = validateSubmissionData(fields, data, images);
    if (missing) {
      return fail(missing);
    }

    const nameCandidates = submittedBy
      .split(/[、,，]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const matchedUser = await prisma.user.findFirst({
      where: {
        status: "active",
        OR: nameCandidates.map((name) => ({ name })),
      },
    });

    const fieldsSnapshot = JSON.parse(
      JSON.stringify(fields)
    ) as FormFieldDefinition[];

    const record = await prisma.formSubmission.create({
      data: {
        id: createId(),
        pointId: point.id,
        templateId: point.template.id,
        templateVersion: point.template.version,
        fieldsSnapshot,
        submittedBy,
        submitterOpenid: user.openid,
        submitterType: matchedUser ? "system_user" : "custom",
        data,
        images,
        editCount: 0,
        isDeleted: false,
        submittedAt: new Date(),
      },
      include: {
        point: { select: { name: true, code: true } },
      },
    });

    return success(
      toSubmissionDetail(
        {
          ...record,
          submitterName: user.name,
        },
        policy
      ),
      "提交成功"
    );
  } catch (error) {
    console.error("submissions POST error:", error);
    setResponseStatus(event, 500);
    return fail("提交失败");
  }
});
