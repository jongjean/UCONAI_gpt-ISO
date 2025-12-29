import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const groups = await prisma.$queryRaw`SELECT guide_id, storage_key, COUNT(*) AS file_count
  FROM guide_files
  GROUP BY guide_id, storage_key
  HAVING COUNT(*) > 1;`;

  if (groups.length === 0) {
    console.log('No duplicate guide files found.');
    return;
  }

  console.log('Duplicate groups detected:', groups.length);

  const duplicates = await prisma.$queryRaw`SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY guide_id, storage_key ORDER BY created_at) AS row_number
    FROM guide_files
  ) ranked
  WHERE ranked.row_number > 1;`;

  const duplicateIds = duplicates.map((row) => row.id);

  console.log('Duplicate record candidates:', duplicateIds.length);

  const result = await prisma.guideFile.deleteMany({
    where: { id: { in: duplicateIds } },
  });

  console.log(`Deleted ${result.count} duplicate guide file record(s).`);
}

main()
  .catch((error) => {
    console.error('Failed to remove duplicate guide files:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
