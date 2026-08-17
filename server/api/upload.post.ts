import { fail, success } from "../utils/response";
import { uploadFile } from "../utils/oss";

export default defineEventHandler(async (event) => {
  try {
    const parts = await readMultipartFormData(event);
    const file = parts?.find((p) => p.name === "file");

    if (!file?.data?.length) {
      setResponseStatus(event, 400);
      return fail(!file ? "请上传文件" : "文件内容为空");
    }

    const buffer = Buffer.from(file.data);
    const fileName =
      (typeof file.filename === "string" && file.filename) ||
      `image-${Date.now()}.jpg`;
    const contentType = file.type || "application/octet-stream";

    if (!contentType.startsWith("image/")) {
      setResponseStatus(event, 400);
      return fail("仅支持上传图片");
    }

    const fileKey = await uploadFile(buffer, fileName, contentType);

    return success(fileKey, "上传成功");
  } catch (error) {
    console.error("upload error:", error);
    setResponseStatus(event, 500);
    return fail("上传失败");
  }
});
