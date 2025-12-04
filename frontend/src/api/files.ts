// src/api/files.ts
import axios from "axios";
import { apiClient } from "./client";

type PresignUploadRequest = {
  engine: string; // e.g., "iso"
  type: "message" | "guide";
  ownerId: string; // messageId or guideId
  filename: string;
};

type PresignUploadResponse = {
  uploadUrl: string;
  objectKey: string;
};

type CommitRequest = {
  engine: string;
  type: "message" | "guide";
  ownerId: string;
  originalName: string;
  objectKey: string;
  mimetype?: string | null;
  size?: number;
};

/**
 * 업로드용 presigned URL 생성
 */
export async function presignUpload(data: PresignUploadRequest) {
  const res = await apiClient.post<PresignUploadResponse>(
    "/ucon/files/presign/upload",
    data
  );
  return res.data;
}

/**
 * presigned URL로 업로드 (PUT)
 */
export async function uploadWithPresignedUrl(
  url: string,
  file: File | Blob,
  mimeType?: string | null
) {
  await axios.put(url, file, {
    headers: {
      "Content-Type": mimeType || file.type || "application/octet-stream",
    },
  });
}

/**
 * 업로드 완료 후 DB 메타 커밋
 */
export async function commitFile(data: CommitRequest) {
  const res = await apiClient.post("/ucon/files/commit", {
    engine: data.engine,
    type: data.type,
    ownerId: data.ownerId,
    originalName: data.originalName,
    objectKey: data.objectKey,
    mimetype: data.mimetype ?? null,
    size: data.size ?? null,
  });
  return res.data;
}
