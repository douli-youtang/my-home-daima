import { fail, success } from "~~/server/utils/response";
import { requireAdminUser } from "~~/server/utils/admin";
import {
  PERMISSION_CATALOG,
  ALL_PERMISSION_KEYS,
} from "~~/shared/permissions";

export default defineEventHandler(async (event) => {
  try {
    const { error } = await requireAdminUser(event);
    if (error) return error;
    return success({
      catalog: PERMISSION_CATALOG,
      allKeys: [...ALL_PERMISSION_KEYS],
    });
  } catch (e) {
    console.error("permissions catalog", e);
    setResponseStatus(event, 500);
    return fail("获取权限目录失败");
  }
});
