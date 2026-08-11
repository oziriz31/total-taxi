const CURRENT_EMPLOYEE_KEY = "taxi.currentEmployeeId";

export function getCurrentEmployeeId(): string | null {
  return localStorage.getItem(CURRENT_EMPLOYEE_KEY);
}

export function setCurrentEmployeeId(id: string | null) {
  if (id) localStorage.setItem(CURRENT_EMPLOYEE_KEY, id);
  else localStorage.removeItem(CURRENT_EMPLOYEE_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const employeeId = getCurrentEmployeeId();
  const headers: Record<string, string> = {
    ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
    ...(employeeId ? { "X-Employee-Id": employeeId } : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  };

  const res = await fetch(`/api${path}`, { ...options, headers });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : undefined;

  if (!res.ok) {
    const message = body?.error ? JSON.stringify(body.error) : res.statusText;
    throw new ApiError(message, res.status);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
  postForm: <T>(path: string, form: FormData) => request<T>(path, { method: "POST", body: form }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data !== undefined ? JSON.stringify(data) : undefined }),
};
