import { fail } from "../utils/response";
import { getObject, isValidFileKey } from "../utils/oss";

/**
 * 通过本站域名代理私有 OSS 图片。
 * Sealos 内网 endpoint 签发的临时链接浏览器/手机无法访问，因此统一走此接口。
 */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const fileKey = String(query.fileKey || "").trim();

    if (!fileKey || !isValidFileKey(fileKey)) {
      setResponseStatus(event, 400);
      return fail("无效的 fileKey");
    }

    const object = await getObject(fileKey);
    const body = object.Body;

    if (!body) {
      setResponseStatus(event, 404);
      return fail("文件不存在");
    }

    const bytes = await body.transformToByteArray();

    setHeader(
      event,
      "Content-Type",
      object.ContentType || "application/octet-stream"
    );
    setHeader(event, "Cache-Control", "private, max-age=300");
    if (object.ContentLength != null) {
      setHeader(event, "Content-Length", String(object.ContentLength));
    } else {
      setHeader(event, "Content-Length", String(bytes.byteLength));
    }

    return Buffer.from(bytes);
  } catch (error) {
    console.error("file proxy error:", error);
    setResponseStatus(event, 500);
    return fail("读取文件失败");
  }
});
