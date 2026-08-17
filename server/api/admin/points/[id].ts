import type { PointStatus } from "@prisma/client";
import { fail, success } from "~~/server/utils/response";
import { requireAdminUser } from "~~/server/utils/admin";
import { createId } from "~~/server/utils/id";
import prisma from "~~/server/utils/prisma";

function toPointItem(point: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  template: { id: string; name: string; version: number } | null;
}) {
  return {
    id: point.id,
    code: point.code,
    name: point.name,
    description: point.description,
    status: point.status,
    createdAt: point.createdAt.toISOString(),
    updatedAt: point.updatedAt.toISOString(),
    template: point.template,
  };
}

export default defineEventHandler(async (event) => {
  const method = event.method;

  if (method === "GET") {
    try {
      const { error, user } = await requireAdminUser(event);
      if (error || !user) return error!;

      const id = getRouterParam(event, "id")!;
      const point = await prisma.point.findFirst({
        where: { id, deletedAt: null },
        include: {
          template: {
            select: { id: true, name: true, version: true },
          },
        },
      });

      if (!point) {
        setResponseStatus(event, 404);
        return fail("点位不存在");
      }

      return success(toPointItem(point));
    } catch (err) {
      console.error("admin points GET one error:", err);
      setResponseStatus(event, 500);
      return fail("获取点位失败");
    }
  }

  if (method === "PUT") {
    try {
      const { error, user } = await requireAdminUser(event, { adminOnly: true });
      if (error || !user) return error!;

      const id = getRouterParam(event, "id")!;
      const body = await readBody(event);
      const name = body?.name !== undefined ? String(body.name).trim() : undefined;
      const description =
        body?.description !== undefined
          ? String(body.description).trim()
          : undefined;
      const status =
        body?.status === "active" || body?.status === "inactive"
          ? (body.status as PointStatus)
          : undefined;

      if (name !== undefined && !name) {
        setResponseStatus(event, 400);
        return fail("点位名称不能为空");
      }

      const existing = await prisma.point.findFirst({
        where: { id, deletedAt: null },
      });

      if (!existing) {
        setResponseStatus(event, 404);
        return fail("点位不存在");
      }

      const point = await prisma.point.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined
            ? { description: description || null }
            : {}),
          ...(status !== undefined ? { status } : {}),
        },
        include: {
          template: {
            select: { id: true, name: true, version: true },
          },
        },
      });

      const action =
        status && status !== existing.status
          ? status === "active"
            ? "activate_point"
            : "deactivate_point"
          : "update_point";

      await prisma.operationLog.create({
        data: {
          id: createId(),
          userId: user.id,
          pointId: point.id,
          action,
          targetId: point.id,
          detail: {
            before: {
              name: existing.name,
              status: existing.status,
              description: existing.description,
            },
            after: {
              name: point.name,
              status: point.status,
              description: point.description,
            },
          },
        },
      });

      return success(point, "更新成功");
    } catch (err) {
      console.error("admin points PUT error:", err);
      setResponseStatus(event, 500);
      return fail("更新点位失败");
    }
  }

  if (method === "DELETE") {
    try {
      const { error, user } = await requireAdminUser(event, { adminOnly: true });
      if (error || !user) return error!;

      const id = getRouterParam(event, "id")!;
      const existing = await prisma.point.findFirst({
        where: { id, deletedAt: null },
      });

      if (!existing) {
        setResponseStatus(event, 404);
        return fail("点位不存在");
      }

      const point = await prisma.point.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: "inactive",
        },
      });

      await prisma.operationLog.create({
        data: {
          id: createId(),
          userId: user.id,
          pointId: point.id,
          action: "delete_point",
          targetId: point.id,
          detail: { code: existing.code, name: existing.name },
        },
      });

      return success({ id: point.id }, "删除成功");
    } catch (err) {
      console.error("admin points DELETE error:", err);
      setResponseStatus(event, 500);
      return fail("删除点位失败");
    }
  }

  setResponseStatus(event, 405);
  return fail("Method Not Allowed");
});
