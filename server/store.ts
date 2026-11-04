import { DatabaseSync } from "node:sqlite";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  chmodSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { DomainError } from "./domain.ts";
import type { Assessment } from "../shared/model.ts";
export const hash = (b: Uint8Array | string) =>
  createHash("sha256").update(b).digest("hex");
export class Store {
  db: DatabaseSync;
  dir: string;
  constructor(dir: string) {
    this.dir = resolve(dir);
    mkdirSync(join(this.dir, "files"), { recursive: true, mode: 0o700 });
    chmodSync(this.dir, 0o700);
    this.db = new DatabaseSync(join(this.dir, "acronym.sqlite"));
    chmodSync(join(this.dir, "acronym.sqlite"), 0o600);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
    this.db.exec(
      readFileSync(
        new URL("../migrations/001_initial.sql", import.meta.url),
        "utf8",
      ),
    );
  }
  list() {
    return (
      this.db
        .prepare("SELECT body FROM assessments ORDER BY rowid DESC")
        .all() as { body: string }[]
    ).map((r) => JSON.parse(r.body) as Assessment);
  }
  get(id: string): Assessment {
    const row = this.db
      .prepare("SELECT body FROM assessments WHERE id=?")
      .get(id) as { body: string } | undefined;
    if (!row) throw new DomainError("Assessment not found.", 404);
    return JSON.parse(row.body);
  }
  insert(a: Assessment) {
    this.db
      .prepare("INSERT INTO assessments VALUES (?,?,?)")
      .run(a.id, a.revision, JSON.stringify(a));
  }
  save(a: Assessment, expected: number) {
    const result = this.db
      .prepare(
        "UPDATE assessments SET revision=?,body=? WHERE id=? AND revision=?",
      )
      .run(a.revision, JSON.stringify(a), a.id, expected);
    if (!result.changes)
      throw new DomainError(
        "This assessment changed in another tab. Reload before saving.",
        409,
      );
  }
  putFile(bytes: Buffer) {
    const digest = hash(bytes),
      path = join(this.dir, "files", digest);
    if (!existsSync(path))
      writeFileSync(path, bytes, { mode: 0o600, flag: "wx" });
    return digest;
  }
  file(digest: string) {
    if (!/^[a-f0-9]{64}$/.test(digest))
      throw new DomainError("Invalid file hash.");
    const bytes = readFileSync(join(this.dir, "files", digest));
    if (hash(bytes) !== digest)
      throw new DomainError("Evidence file integrity check failed.");
    return bytes;
  }
  close() {
    this.db.close();
  }
}
