-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'SUPER_ADMIN');

-- AlterTable
ALTER TABLE "User"
    ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER',
    ADD COLUMN     "approved_at" TIMESTAMP(3),
    ADD COLUMN     "approved_by_id" UUID;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
