-- XpTransaction is a write-only audit log: nothing in the application reads it.
-- It carried four indexes (6.02 MB of index against 6.52 MB of data), so every
-- insert updated four B-trees for queries that do not exist.
-- Only the per-player lookup is kept, for a future history view.
DROP INDEX `XpTransaction_actionType_idx` ON `XpTransaction`;
DROP INDEX `XpTransaction_vocationalActionType_idx` ON `XpTransaction`;
DROP INDEX `XpTransaction_createdAt_idx` ON `XpTransaction`;
