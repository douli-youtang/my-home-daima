import type { ApiResponse } from "~/lib/api-response";

export async function apiRequest<T>(
  url: string,
  init?: RequestInit & { openid?: string }
): Promise<T> {
  const headers = new Headers(init?.headers || {});
  if (init?.openid) headers.set("x-openid", init.openid);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let json: ApiResponse<T>;
  try {
    json = JSON.parse(text) as ApiResponse<T>;
  } catch {
    throw new Error(res.ok ? "服务器返回异常" : `请求失败 (${res.status})`);
  }
  if (json.code !== 0) {
    throw new Error(json.msg || "请求失败");
  }
  return json.data;
}

export function useApi() {
  const { getAdminSession, getStoredSession } = useSession();

  const adminRequest = async <T>(url: string, init?: RequestInit) => {
    const session = getAdminSession();
    return apiRequest<T>(url, {
      ...init,
      openid: session?.openid,
    });
  };

  const openidRequest = async <T>(url: string, init?: RequestInit) => {
    const session = getStoredSession();
    return apiRequest<T>(url, {
      ...init,
      openid: session?.openid,
    });
  };

  return {
    apiRequest,
    adminRequest,
    openidRequest,
    getFileUrl: (key: string) =>
      `/api/file?fileKey=${encodeURIComponent(key)}`,
  };
}
