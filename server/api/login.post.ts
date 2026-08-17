import { fail, success } from "~~/server/utils/response";
import { isAdminRole, loadUserWithRole } from "~~/server/utils/admin";
import { verifyPassword } from "~~/server/utils/password";
import prisma from "~~/server/utils/prisma";

function toLoginData(user: {
  roleCode: string;
  roleName: string;
  roleId: string;
  name: string;
  openid: string;
  mustChangePassword: boolean;
  permissions: string[];
}) {
  return {
    role: user.roleCode,
    roleCode: user.roleCode,
    roleName: user.roleName,
    roleId: user.roleId,
    name: user.name,
    openid: user.openid,
    mustChangePassword: Boolean(user.mustChangePassword),
    permissions: user.permissions,
  };
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const openid = String(body?.openid || "").trim();
    const name = String(body?.name || "").trim();
    const password = String(body?.password ?? "");
    /** admin：仅管理员/维护员可登录管理后台 */
    const scope = String(body?.scope || "").trim().toLowerCase();

    if (!openid && !name) {
      setResponseStatus(event, 400);
      return fail("请提供 openid 或 name");
    }

    // 扫码/会话恢复：仅 openid，不校验密码
    if (openid && !name) {
      const authed = await loadUserWithRole(openid);
      if (!authed) {
        return fail("用户不存在，请联系管理员");
      }
      if (scope === "admin" && !isAdminRole(authed.roleCode)) {
        return fail("作业人员无法登录管理后台，请通过扫码进入");
      }
      return success(toLoginData(authed), "success");
    }

    // 账号密码登录：优先按姓名，其次按工号（openid，如 admin）
    let row = await prisma.user.findFirst({
      where: { name },
      select: { openid: true, password: true, status: true },
    });
    if (!row) {
      row = await prisma.user.findUnique({
        where: { openid: name },
        select: { openid: true, password: true, status: true },
      });
    }

    if (!row || row.status !== "active") {
      return fail("用户不存在，请联系管理员");
    }

    const ok = await verifyPassword(password, row.password);
    if (!ok) {
      return fail("密码错误");
    }

    const authed = await loadUserWithRole(row.openid);
    if (!authed) {
      return fail("用户不存在，请联系管理员");
    }

    if (scope === "admin" && !isAdminRole(authed.roleCode)) {
      return fail("作业人员无法登录管理后台，请通过扫码进入");
    }

    return success(toLoginData(authed), "success");
  } catch (error) {
    console.error("login error:", error);
    setResponseStatus(event, 500);
    return fail("登录失败");
  }
});
