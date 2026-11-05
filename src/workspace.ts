import { newAssessment, name, type Assessment } from "../shared/model";
import { applyCommand, addEvidence, demand } from "../shared/domain";
import { backupSchema } from "../shared/validation";

// Module memory belongs to this tab. Never use browser storage, cookies, a
// service worker, or a server session for the hosted workspace.
export let ephemeral = false;
const assessments = new Map<string, Assessment>();
const files = new Map<string, { data: string; blob: Blob }>();
const exports = new Map<
  string,
  {
    assessmentId: string;
    id: string;
    createdAt: string;
    status: string;
    hasPDF: number;
    documents: Record<string, Blob>;
  }
>();
export async function request(path: string, body?: unknown) {
  const response = await fetch(
    `/api${path}`,
    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "X-Acronym-Request": "local",
          },
          body: JSON.stringify(body),
        },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
export async function initializeWorkspace() {
  const config = await request("/config");
  if (!["ephemeral", "local"].includes(config.mode))
    throw new Error("Workspace configuration is unavailable. Please reload.");
  ephemeral = config.mode === "ephemeral";
  // A browser's back/forward cache must not revive an old vendor's workspace.
  if (ephemeral)
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) window.location.reload();
    });
}
function assessment(id: string) {
  const a = assessments.get(id);
  demand(
    a,
    "Assessment is no longer in this tab. Restore a downloaded backup to continue.",
  );
  return a;
}
const decode = (data: string) =>
  Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
const encode = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
};
function portable(a: Assessment) {
  return {
    format: "acronym-backup-v1",
    assessment: a,
    files: [...new Set(a.evidence.map((e) => e.hash))].map((hash) => {
      const file = files.get(hash);
      demand(file, "Evidence bytes are missing from this tab.");
      return { hash, data: file.data };
    }),
  };
}
export async function api(path: string, body?: any): Promise<any> {
  if (!ephemeral) return request(path, body);
  if (path === "/assessments") {
    if (body === undefined)
      return [...assessments.values()].map((a) => ({
        id: a.id,
        product: a.product.details.product,
        vendor: a.product.details.vendor,
        synthetic: a.synthetic,
      }));
    const a = newAssessment(crypto.randomUUID(), body.synthetic === true);
    assessments.set(a.id, a);
    return structuredClone(a);
  }
  if (path === "/restore") {
    const backup = backupSchema.parse(body);
    const a: Assessment = await request("/temporary/restore", backup);
    for (const e of a.evidence) {
      const f = backup.files.find((f) => f.hash === e.hash)!;
      files.set(e.hash, { data: f.data, blob: new Blob([decode(f.data)]) });
    }
    assessments.set(a.id, a);
    return structuredClone(a);
  }
  const match = /^\/assessments\/([^/]+)(?:\/(commands|exports))?$/.exec(path);
  demand(match, "Unsupported workspace operation.");
  const a = assessment(match[1]);
  if (!match[2]) return structuredClone(a);
  if (match[2] === "commands") {
    demand(
      a.revision === body.revision,
      "Assessment changed. Reopen this view before saving.",
    );
    const next = applyCommand(a, body.command, name.parse(body.actor));
    assessments.set(a.id, next);
    return structuredClone(next);
  }
  if (body === undefined)
    return [...exports.values()]
      .filter((s) => s.assessmentId === a.id)
      .map(({ documents, ...summary }) => summary)
      .reverse();
  demand(
    a.revision === body.revision,
    "Reopen the assessment before exporting.",
  );
  portable(a); // Every source must still have its original bytes in this tab.
  const result = await request("/temporary/export", {
    assessment: a,
    final: body.final,
    reviewer: body.reviewer,
  });
  const s = result.snapshot;
  const entry = {
    assessmentId: a.id,
    id: s.id,
    createdAt: s.createdAt,
    status: s.status,
    hasPDF: 1,
    documents: {
      json: new Blob([JSON.stringify(s, null, 2)], {
        type: "application/json",
      }),
      docx: new Blob([decode(result.docx)], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
      pdf: new Blob([decode(result.pdf)], { type: "application/pdf" }),
    },
  };
  exports.set(s.id, entry);
  return { id: s.id, createdAt: s.createdAt, status: s.status };
}
export async function uploadEvidence(a: Assessment, file: File, actor: string) {
  name.parse(actor);
  const form = new FormData();
  form.append("file", file);
  form.append("actor", actor);
  form.append("revision", String(a.revision));
  const response = await fetch(
    ephemeral ? "/api/temporary/extract" : `/api/assessments/${a.id}/evidence`,
    {
      method: "POST",
      headers: { "X-Acronym-Request": "local" },
      body: form,
    },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Upload failed");
  if (!ephemeral) return data;
  demand(
    a.revision === assessment(a.id).revision,
    "Assessment changed before the upload completed.",
  );
  const bytes = new Uint8Array(await file.arrayBuffer());
  const digest = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  demand(digest === data.hash, "Uploaded evidence integrity check failed.");
  const next = addEvidence(
    a,
    {
      id: crypto.randomUUID(),
      fileName: data.fileName,
      hash: digest,
      uploadedAt: new Date().toISOString(),
      product: a.product.details.product,
      version: a.product.details.version,
      status: "Uncertain",
      extraction:
        data.segments.length &&
        data.segments.every((s: { text: string }) => s.text.trim())
          ? "Extracted"
          : "Manual transcription required",
      segments: data.segments,
      notes:
        "Confirm relevance and currency before using this source for approval.",
      excludeFromAI: true,
    },
    actor,
  );
  files.set(digest, { data: encode(bytes), blob: file });
  assessments.set(a.id, next);
  return structuredClone(next);
}
export function temporaryDownload(path: string) {
  const parts = path.split("/");
  let blob: Blob | undefined, filename: string;
  if (parts[2] === "exports") {
    blob = exports.get(parts[3])?.documents[parts[4]];
    filename = `assessment-${parts[3]}.${parts[4]}`;
  } else {
    const a = assessment(parts[3]);
    if (parts[4] === "backup") {
      blob = new Blob([JSON.stringify(portable(a))], {
        type: "application/json",
      });
      filename = `acronym-backup-${a.id}.json`;
    } else {
      const e = a.evidence.find((e) => e.id === parts[5]);
      demand(e, "Evidence was not found.");
      blob = files.get(e.hash)?.blob;
      filename = e.fileName;
    }
  }
  demand(blob, "This download is no longer in the open tab.");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
