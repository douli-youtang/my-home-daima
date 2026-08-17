import type { ApiResponse } from "./api-response";
import type {
  FormFieldDefinition,
  LoginResult,
  QrcodeInfo,
  RecordItem,
  UserRole,
} from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = (await res.json()) as ApiResponse<T>;
  if (json.code !== 0) {
    throw new Error(json.msg || "请求失败");
  }
  return json.data;
}

export function loginApi(openid: string) {
  return request<Pick<LoginResult, "role" | "name" | "openid">>("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ openid }),
  });
}

export function loginByNameApi(name: string, password: string) {
  return request<Pick<LoginResult, "role" | "name" | "openid">>("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, password }),
  });
}

export function fetchQrcodeApi(scene: string) {
  return request<QrcodeInfo>(`/api/qrcode/${encodeURIComponent(scene)}`);
}

export type SceneRecordsResult = {
  pointName: string;
  pointCode: string;
  list: RecordItem[];
};

export function fetchRecordsApi(scene: string, openid: string) {
  return request<SceneRecordsResult>(
    `/api/records/${encodeURIComponent(scene)}?openid=${encodeURIComponent(openid)}`
  );
}

export async function uploadImageApi(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  return request<string>("/api/upload", {
    method: "POST",
    body: formData,
  });
}

export function getSignedUrlApi(fileKey: string) {
  return request<string>(
    `/api/signed-url?fileKey=${encodeURIComponent(fileKey)}`
  );
}

/** 浏览器可访问的图片地址（经本站代理私有 OSS） */
export function getFileUrl(fileKey: string) {
  return `/api/file?fileKey=${encodeURIComponent(fileKey)}`;
}

export type WorkerSubmissionListItem = {
  id: string;
  pointName: string;
  pointCode: string;
  submittedBy: string;
  submitterName?: string;
  editCount: number;
  maxEdits?: number;
  remainingEdits: number;
  canEdit: boolean;
  editLockReason: "count" | "timeout" | null;
  editLockMessage: string;
  editableUntil: string | null;
  editWindowHours?: number;
  pointLockHours?: number;
  submittedAt: string;
  imageCount: number;
};

export type WorkerSubmissionDetail = {
  id: string;
  pointName: string;
  pointCode: string;
  submittedBy: string;
  submitterName?: string;
  data: import("./types/form-fields").FormFieldValues;
  images: string[];
  fieldsSnapshot: FormFieldDefinition[];
  editCount: number;
  maxEdits: number;
  remainingEdits: number;
  canEdit: boolean;
  editLockReason: "count" | "timeout" | null;
  editLockMessage: string;
  editableUntil: string | null;
  editWindowHours?: number;
  pointLockHours?: number;
  submittedAt: string;
};

export type SubmissionPolicy = {
  maxSubmissionEdits: number;
  pointLockHours: number;
  editWindowHours: number;
};

export function fetchMySubmissionsApi(openid: string) {
  return request<{
    list: WorkerSubmissionListItem[];
    scope?: "all" | "mine";
    policy?: SubmissionPolicy;
  }>(`/api/submissions?openid=${encodeURIComponent(openid)}`);
}

export function fetchSubmissionDetailApi(id: string, openid: string) {
  return request<WorkerSubmissionDetail>(
    `/api/submissions/${encodeURIComponent(id)}?openid=${encodeURIComponent(openid)}`
  );
}

export type ActiveSubmissionResult = {
  active: boolean;
  submission: (WorkerSubmissionDetail & {
    isOwner?: boolean;
    lockedUntil?: string | null;
  }) | null;
  policy?: SubmissionPolicy;
  pointLockHint?: string;
};

/** 查询二维码占用窗口内是否已有有效填报 */
export function fetchActiveSubmissionApi(scene: string, openid: string) {
  return request<ActiveSubmissionResult>(
    `/api/submissions/active?scene=${encodeURIComponent(scene)}&openid=${encodeURIComponent(openid)}`
  );
}

export type { UserRole, FormFieldDefinition };
