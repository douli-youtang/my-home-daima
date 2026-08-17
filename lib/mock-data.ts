import type { RecordItem } from "./types";

/** 历史记录仍使用模拟数据，后续替换为 form_submissions 查询 */
export function mockRecords(scene: string): RecordItem[] {
  // TODO: 替换为实际数据库查询
  return [
    {
      id: "1",
      scene,
      openid: "worker_test",
      name: "张工",
      status: "正常",
      remark: "种子联调占位记录",
      imageKeys: [],
      createdAt: new Date().toISOString(),
    },
  ];
}
