import { fail, success } from "../utils/response";
import { isAdminRole } from "../utils/admin";
import { verifyPassword } from "../utils/password";
import prisma from "../utils/prisma";

function toLoginData(user: {
  role: string;
  name: string;
  openid: string;
  mustChangePassword: boolean;
}) {
  return {
    role: user.role,
    name: user.name,
    openid: user.openid,
    mustChangePassword: Boolean(user.mustChangePassword),
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

    let user = null;

    if (openid && !name) {
      // 扫码/会话恢复：仅 openid，不校验密码
      user = await prisma.user.findUnique({ where: { openid } });
      if (!user || user.status !== "active") {
        return fail("用户不存在，请联系管理员");
      }
      if (scope === "admin" && !isAdminRole(user.role)) {
        return fail("作业人员无法登录管理后台，请通过扫码进入");
      }
      return success(toLoginData(user), "success");
    }

    // 账号密码登录：按姓名查，未命中则按工号（openid）再查
    user = await prisma.user.findFirst({ where: { name } });
    if (!user) {
      user = await prisma.user.findUnique({ where: { openid: name } });
    }

    if (!user || user.status !== "active") {
      return fail("用户不存在，请联系管理员");
    }

    const ok = await verifyPassword(password, user.password);
    if (!ok) {
      return fail("密码错误");
    }

    if (scope === "admin" && !isAdminRole(user.role)) {
      return fail("作业人员无法登录管理后台，请通过扫码进入");
    }

    return success(toLoginData(user), "success");
  } catch (error) {
    console.error("login error:", error);
    setResponseStatus(event, 500);
    return fail("登录失败");
  }
});
