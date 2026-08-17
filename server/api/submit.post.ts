import { fail } from "../utils/response";

/** 已废弃，请改用 POST /api/submissions */
export default defineEventHandler(async (event) => {
  setResponseStatus(event, 410);
  return fail("接口已迁移，请使用 POST /api/submissions");
});
