import { fail, success } from "~~/server/utils/response";
import { getSignedUrl, isValidFileKey } from "~~/server/utils/oss";

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const fileKey = String(query.fileKey || "").trim();

    if (!fileKey) {
      setResponseStatus(event, 400);
      return fail("fileKey 不能为空");
    }
    if (!isValidFileKey(fileKey)) {
      setResponseStatus(event, 400);
      return fail("无效的 fileKey");
    }

    const url = await getSignedUrl(fileKey);

    return success(url);
  } catch (error) {
    console.error("signed-url error:", error);
    setResponseStatus(event, 500);
    return fail("生成临时链接失败");
  }
});
