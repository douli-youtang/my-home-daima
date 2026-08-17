import { fail, success } from "../../utils/response";
import { requireAdminUser } from "../../utils/admin";
import { getSystemSettings } from "../../utils/system-settings";

export default defineEventHandler(async (event) => {
  try {
    const { error, user } = await requireAdminUser(event, { adminOnly: true });
    if (error || !user) return error!;

    const settings = await getSystemSettings();
    return success(settings, "success");
  } catch (err) {
    console.error("admin settings GET error:", err);
    setResponseStatus(event, 500);
    return fail("获取设置失败");
  }
});
