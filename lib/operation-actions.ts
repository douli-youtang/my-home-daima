export const OPERATION_ACTION_LABELS: Record<string, string> = {
  delete_record: "删除提交记录",
  restore_record: "恢复提交记录",
  update_template: "修改表单模板",
  deactivate_point: "失效点位",
  activate_point: "生效点位",
  create_point: "新增点位",
  update_point: "更新点位",
  delete_point: "删除点位",
  update_user: "更新用户信息",
  delete_user: "删除用户",
  create_user: "新增用户",
  update_settings: "修改系统设置",
};

export function getActionLabel(action: string): string {
  return OPERATION_ACTION_LABELS[action] || action;
}
