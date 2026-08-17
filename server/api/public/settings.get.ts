import { fail, success } from "~~/server/utils/response";
import {
  getSystemSettings,
  toSubmissionPolicy,
} from "~~/server/utils/system-settings";

/** 公开配置：系统名称 + 填表策略（前端展示提示用） */
export default defineEventHandler(async (event) => {
  try {
    const settings = await getSystemSettings();
    return success({
      systemName: settings.systemName,
      policy: toSubmissionPolicy(settings),
    });
  } catch (err) {
    console.error("public settings error:", err);
    setResponseStatus(event, 500);
    return fail("获取配置失败");
  }
});
