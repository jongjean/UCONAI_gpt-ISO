ALTER TABLE "conversations" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "guides" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Initialize conversation sort order (newest first => lowest sort_order)
WITH ranked_conversations AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY COALESCE(user_id, '00000000-0000-0000-0000-000000000000') ORDER BY created_at DESC) - 1 AS rn
  FROM conversations
)
UPDATE conversations AS c
SET sort_order = r.rn
FROM ranked_conversations AS r
WHERE c.id = r.id;

-- Initialize guide sort order
WITH ranked_global_guides AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(user_id, '00000000-0000-0000-0000-000000000000')
           ORDER BY created_at ASC
         ) - 1 AS rn
  FROM guides
  WHERE scope = 'GLOBAL'
),
ranked_conversation_guides AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(conversation_id, '00000000-0000-0000-0000-000000000000')
           ORDER BY created_at ASC
         ) - 1 AS rn
  FROM guides
  WHERE scope = 'CONVERSATION'
)
UPDATE guides AS g
SET sort_order = COALESCE(rg.rn, rc.rn, 0)
FROM ranked_global_guides AS rg
FULL OUTER JOIN ranked_conversation_guides AS rc ON rg.id = rc.id
WHERE g.id = COALESCE(rg.id, rc.id);
