export type { FormFieldDefinition, FormFieldValues, FieldType } from "./types/form-fields";
export type { OperationAction, SubmissionImages } from "./types/db";

/** 前端登录角色（含无权限 guest） */
export type UserRole = "worker" | "maintainer" | "admin" | "guest";

export type LoginResult = {
  openid: string;
  role: UserRole;
  name: string;
  /** 首次登录或管理员重置后需强制改密 */
  mustChangePassword?: boolean;
};

export type QrcodeInfo = {
  pointName: string;
  templateFields: import("./types/form-fields").FormFieldDefinition[];
  templateVersion: number;
};

/** 扫码端历史记录（含详情字段） */
export type RecordItem = {
  id: string;
  scene: string;
  openid: string;
  name: string;
  /** 登录账号姓名（提交人） */
  submitterName?: string;
  status: string;
  remark: string;
  imageKeys: string[];
  createdAt: string;
  isDeleted?: boolean;
  pointName?: string;
  data?: import("./types/form-fields").FormFieldValues;
  fieldsSnapshot?: import("./types/form-fields").FormFieldDefinition[];
};

export type FormSubmitPayload = {
  scene: string;
  openid: string;
  templateVersion?: number;
  data: import("./types/form-fields").FormFieldValues;
  imageKeys: string[];
};
