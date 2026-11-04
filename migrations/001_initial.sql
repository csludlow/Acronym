CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS assessments (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS snapshots (id TEXT PRIMARY KEY, assessment_id TEXT NOT NULL REFERENCES assessments(id), created_at TEXT NOT NULL, body TEXT NOT NULL, docx BLOB NOT NULL);
INSERT OR IGNORE INTO migrations VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
