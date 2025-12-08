const API_BASE = "/api";

export type PendingUser = {
  id: string;
  email: string;
  createdAt: string;
  role: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

async function handleResponse<T>(res: Response, fallbackError: string): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = (err as { error?: string }).error || fallbackError;
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export async function fetchPendingUsers(token: string): Promise<PendingUser[]> {
  const res = await fetch(`${API_BASE}/auth/admin/users/pending`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await handleResponse<{ users: PendingUser[] }>(
    res,
    "승인 대기 목록을 불러오지 못했습니다."
  );
  return data.users;
}

export async function approveUser(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/admin/users/${id}/approve`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  await handleResponse(res, "사용자 승인을 처리하지 못했습니다.");
}

export async function rejectUser(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/admin/users/${id}/reject`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  await handleResponse(res, "사용자 거부를 처리하지 못했습니다.");
}

export async function deleteUser(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/admin/users/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  await handleResponse(res, "사용자 삭제를 처리하지 못했습니다.");
}
