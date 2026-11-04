ALTER TABLE snapshots ADD COLUMN pdf BLOB;
INSERT INTO migrations VALUES (2, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
