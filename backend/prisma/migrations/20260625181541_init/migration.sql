-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_dm_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" DATETIME,
    "imageUrl" TEXT,
    "reactions" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "dm_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "dm_conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "dm_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_dm_messages" ("authorId", "content", "conversationId", "createdAt", "editedAt", "id", "imageUrl") SELECT "authorId", "content", "conversationId", "createdAt", "editedAt", "id", "imageUrl" FROM "dm_messages";
DROP TABLE "dm_messages";
ALTER TABLE "new_dm_messages" RENAME TO "dm_messages";
CREATE INDEX "dm_messages_conversationId_createdAt_idx" ON "dm_messages"("conversationId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
