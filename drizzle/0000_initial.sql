CREATE TABLE IF NOT EXISTS records (
  type TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(type,id)
) STRICT;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL,
  data TEXT NOT NULL
) STRICT;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL
) STRICT;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS write_revision (
  id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL CHECK(version>=0)
) STRICT;
--> statement-breakpoint
INSERT OR IGNORE INTO write_revision VALUES (1,0);
