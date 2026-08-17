import { fail, success } from "~~/server/utils/response";
import {
  hashPassword,
  isValidPasswordLength,
  verifyPassword,
  MIN_PASSWORD_LENGTH,
} from "~~/server/utils/password";
import prisma from "~~/server/utils/prisma";

/**
 * POST /api/password/change
 * - 常规修改：需验证当前密码
 * - 首次强制修改（mustChangePassword=true）：可不传当前密码（用户刚完成登录）
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const account = String(body?.name || body?.account || "").trim();
    const openid = String(body?.openid || "").trim();
    const oldPassword = String(body?.oldPassword ?? "");
    const newPassword = String(body?.newPassword ?? "");
    const confirmPassword = String(body?.confirmPassword ?? "");
    const firstLogin = Boolean(body?.firstLogin);

    if (!account && !openid) {
      setResponseStatus(event, 400);
      return fail("请输入账号");
    }
    if (!newPassword) {
      setResponseStatus(event, 400);
      return fail("请输入新密码");
    }
    if (!isValidPasswordLength(newPassword)) {
      return fail(`新密码至少 ${MIN_PASSWORD_LENGTH} 位`);
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      return fail("两次输入的新密码不一致");
    }

    let user = null;
    if (openid) {
      user = await prisma.user.findUnique({ where: { openid } });
    }
    if (!user && account) {
      user = await prisma.user.findFirst({ where: { name: account } });
      if (!user) {
        user = await prisma.user.findUnique({ where: { openid: account } });
      }
    }

    if (!user || user.status !== "active") {
      return fail("用户不存在或已停用");
    }

    const allowSkipOld = firstLogin && user.mustChangePassword;

    if (!allowSkipOld) {
      if (!oldPassword) {
        setResponseStatus(event, 400);
        return fail("请输入当前密码");
      }
      const ok = await verifyPassword(oldPassword, user.password);
      if (!ok) {
        return fail("当前密码错误");
      }
    }

    if (await verifyPassword(newPassword, user.password)) {
      return fail("新密码不能与当前密码相同");
    }

    const hashed = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        mustChangePassword: false,
      },
    });

    return success(
      {
        openid: user.openid,
        name: user.name,
        mustChangePassword: false,
      },
      allowSkipOld ? "密码设置成功" : "密码修改成功"
    );
  } catch (error) {
    console.error("password change error:", error);
    setResponseStatus(event, 500);
    return fail("修改密码失败");
  }
});
