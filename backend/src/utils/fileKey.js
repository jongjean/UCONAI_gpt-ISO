import { randomUUID } from "crypto";

/**
 * MinIO object key 규칙:
 *   <engine>/<type>/<ownerId>/<uuid>_<filename>
 *
 * 예시:
 *   iso/message/test-1/uuid_manual.pdf
 */
export function buildObjectKey(engine, type, ownerId, filename) {
  const uuid = randomUUID();
  const safe = filename.replace(/\s+/g, "_");
  return `${engine}/${type}/${ownerId}/${uuid}_${safe}`;
}
