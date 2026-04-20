ALTER TYPE "UserRole" RENAME TO "UserRole_old";

CREATE TYPE "UserRole" AS ENUM ('admin', 'staff', 'customer');

ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole"
  USING (
    CASE
      WHEN "role"::text IN ('operator', 'supervisor') THEN 'staff'
      ELSE "role"::text
    END
  )::"UserRole";

DROP TYPE "UserRole_old";