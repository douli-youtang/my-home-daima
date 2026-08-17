import { fail, success } from "~~/server/utils/response";
import { requireAdminUser } from "~~/server/utils/admin";
import { createId } from "~~/server/utils/id";
import prisma from "~~/server/utils/prisma";
import {
  getSystemSettings,
  normalizeSubmissionPolicy,
  upsertSystemSettings,
} from "~~/server/utils/system-settings";

export default defineEventHandler(async (event) => {
  try {
    const { error, user } = await requireAdminUser(event, { adminOnly: true });
    if (error || !user) return error!;

    const body = await readBody(event);
    const systemName =
      body?.systemName !== undefined
        ? String(body.systemName).trim()
        : undefined;
    const sessionDays =
      body?.sessionDays !== undefined
        ? Number(body.sessionDays)
        : undefined;

    if (systemName !== undefined && !systemName) {
      setResponseStatus(event, 400);
      return fail("系统名称不能为空");
    }
    if (
      sessionDays !== undefined &&
      ![7, 14, 30].includes(sessionDays)
    ) {
      setResponseStatus(event, 400);
      return fail("会话有效期仅支持 7/14/30 天");
    }

    const hasPolicyField =
      body?.maxSubmissionEdits !== undefined ||
      body?.pointLockHours !== undefined ||
      body?.editWindowHours !== undefined;

    let policyPatch:
      | {
          maxSubmissionEdits?: number;
          pointLockHours?: number;
          editWindowHours?: number;
        }
      | undefined;

    if (hasPolicyField) {
      const current = await getSystemSettings();
      const normalized = normalizeSubmissionPolicy({
        maxSubmissionEdits:
          body?.maxSubmissionEdits !== undefined
            ? Number(body.maxSubmissionEdits)
            : current.maxSubmissionEdits,
        pointLockHours:
          body?.pointLockHours !== undefined
            ? Number(body.pointLockHours)
            : current.pointLockHours,
        editWindowHours:
          body?.editWindowHours !== undefined
            ? Number(body.editWindowHours)
            : current.editWindowHours,
      });

      if (
        body?.maxSubmissionEdits !== undefined &&
        !Number.isFinite(Number(body.maxSubmissionEdits))
      ) {
        setResponseStatus(event, 400);
        return fail("修改次数上限无效");
      }
      if (
        body?.pointLockHours !== undefined &&
        !Number.isFinite(Number(body.pointLockHours))
      ) {
        setResponseStatus(event, 400);
        return fail("占用窗口无效");
      }
      if (
        body?.editWindowHours !== undefined &&
        !Number.isFinite(Number(body.editWindowHours))
      ) {
        setResponseStatus(event, 400);
        return fail("可修改时间窗口无效");
      }

      policyPatch = {
        maxSubmissionEdits:
          body?.maxSubmissionEdits !== undefined
            ? normalized.maxSubmissionEdits
            : undefined,
        pointLockHours:
          body?.pointLockHours !== undefined
            ? normalized.pointLockHours
            : undefined,
        editWindowHours:
          body?.editWindowHours !== undefined
            ? normalized.editWindowHours
            : undefined,
      };
    }

    const before = await getSystemSettings();
    const after = await upsertSystemSettings({
      systemName,
      sessionDays,
      ...policyPatch,
    });

    await prisma.operationLog.create({
      data: {
        id: createId(),
        userId: user.id,
        action: "update_settings",
        targetId: "system_settings",
        detail: { before, after },
      },
    });

    return success(after, "保存成功");
  } catch (err) {
    console.error("admin settings PUT error:", err);
    setResponseStatus(event, 500);
    return fail("保存设置失败");
  }
});
