import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  questions,
  starters,
  productFields,
  metrics,
  outstanding,
  conflicts,
  type Assessment,
  type Answer,
  type Reference,
  type Criterion,
  type Test,
  type ProductKey,
  type Evidence,
} from "../shared/model";
import "./style.css";
type Summary = {
  id: string;
  product: string;
  vendor: string;
  synthetic: boolean;
};
type ExportItem = { id: string; createdAt: string; status: string };
const tabs = [
  "Overview",
  "Product setup",
  "Evidence",
  "Questionnaire",
  "Accessibility",
  "Review queue",
  "Exports",
] as const;
type Tab = (typeof tabs)[number];
async function api(path: string, body?: unknown) {
  const r = await fetch(
    `/api${path}`,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Acronym-Request": "local",
          },
          body: JSON.stringify(body),
        },
  );
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Request failed");
  return data;
}
function Field({
  label,
  value,
  onChange,
  multiline = false,
  required = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  multiline?: boolean;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      {multiline ? (
        <textarea
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          required={required}
        />
      ) : (
        <input
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
      )}{" "}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: readonly string[];
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o || "Choose a response"}
          </option>
        ))}
      </select>
    </label>
  );
}
function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={`badge ${children === "Approved" || children === "Pass" ? "good" : ""}`}
    >
      {children}
    </span>
  );
}
function Card({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
function ReferenceEditor({
  a,
  refs,
  onChange,
}: {
  a: Assessment;
  refs: Reference[];
  onChange: (r: Reference[]) => void;
}) {
  const [eid, setEid] = useState(""),
    [locator, setLocator] = useState(""),
    [quote, setQuote] = useState("");
  const e = a.evidence.find((x) => x.id === eid);
  return (
    <fieldset>
      <legend>Documentary evidence</legend>
      <p className="muted">
        Choose an exact source location. A quoted passage must exist there.
      </p>
      {refs.map((r, i) => (
        <div className="ref" key={i}>
          <span>
            {a.evidence.find((e) => e.id === r.evidenceId)?.fileName} ·{" "}
            {r.locator}
            {r.quote && <q>{r.quote}</q>}
          </span>
          <button
            type="button"
            className="quiet"
            onClick={() => onChange(refs.filter((_, n) => n !== i))}
          >
            Remove reference {i + 1}
          </button>
        </div>
      ))}
      <div className="grid two">
        <label className="field">
          <span>Evidence file</span>
          <select
            value={eid}
            onChange={(ev) => {
              setEid(ev.target.value);
              setLocator("");
              setQuote("");
            }}
          >
            <option value="">Choose file</option>
            {a.evidence.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fileName} — {e.status}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Source location</span>
          <select
            value={locator}
            onChange={(ev) => setLocator(ev.target.value)}
          >
            <option value="">Choose location</option>
            {e?.segments.map((s) => (
              <option key={s.locator} value={s.locator}>
                {s.locator}
              </option>
            ))}
          </select>
        </label>
      </div>
      {e && locator && (
        <pre className="excerpt">
          {e.segments.find((s) => s.locator === locator)?.text}
        </pre>
      )}
      <Field
        label="Exact quotation (optional)"
        value={quote}
        onChange={setQuote}
      />
      <button
        type="button"
        className="secondary"
        disabled={!eid || !locator}
        onClick={() => {
          onChange([...refs, { evidenceId: eid, locator, quote }]);
          setQuote("");
        }}
      >
        Attach reference
      </button>
    </fieldset>
  );
}
function App() {
  const [list, setList] = useState<Summary[]>([]),
    [a, setA] = useState<Assessment | null>(null),
    [tab, setTab] = useState<Tab>("Overview"),
    [actor, setActor] = useState(localStorage.getItem("acronym-author") || ""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const refresh = async () => setList(await api("/assessments"));
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      setDirty(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const load = (id: string) =>
    run(async () => {
      setA(await api(`/assessments/${id}`));
      setTab("Overview");
    });
  const create = (synthetic: boolean) =>
    run(async () => {
      const next = await api("/assessments", { synthetic });
      setA(next);
      setTab("Product setup");
      await refresh();
      setMessage(
        synthetic
          ? "Synthetic demonstration created. All customer descriptions need confirmation."
          : "Assessment created. Start with the product details you know.",
      );
    });
  const command = (c: unknown) =>
    run(async () => {
      if (!actor.trim())
        throw new Error("Enter your name in the sidebar before saving.");
      setA(
        await api(`/assessments/${a!.id}/commands`, {
          revision: a!.revision,
          actor,
          command: c,
        }),
      );
      await refresh();
      setMessage("Saved locally.");
    });
  const navigate = (fn: () => void) => {
    if (
      dirty &&
      !window.confirm(
        "You have unsaved edits. Leave this view and discard them?",
      )
    )
      return;
    setDirty(false);
    setError("");
    setMessage("");
    fn();
  };
  const common = { a: a!, command, actor };
  return (
    <div className="shell">
      <a className="skip" href="#main">
        Skip to main content
      </a>
      <aside>
        <div className="brand">
          <span className="brand-mark">a.</span>
          <div>
            Acronym<small>Vendor assessment workspace</small>
          </div>
        </div>
        <div className="local">
          <span />
          LOCAL WORKSPACE · AI OFF
        </div>
        <label className="field">
          <span>Current assessment</span>
          <select
            value={a?.id || ""}
            onChange={(e) =>
              navigate(() => {
                if (e.target.value) void load(e.target.value);
              })
            }
          >
            <option value="">Choose an assessment</option>
            {list.map((x) => (
              <option value={x.id} key={x.id}>
                {x.synthetic ? "Demo · " : ""}
                {x.product}
              </option>
            ))}
          </select>
        </label>
        <nav aria-label="Assessment sections">
          {tabs.map((t, i) => (
            <button
              key={t}
              disabled={!a}
              aria-current={tab === t ? "page" : undefined}
              onClick={() => navigate(() => setTab(t))}
            >
              <span className="nav-number">0{i + 1}</span>
              {t}
              {t === "Review queue" && a && (
                <span className="count">
                  {
                    Object.values(a.answers).filter(
                      (v) => v.status !== "Approved",
                    ).length
                  }
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Field
            label="Your name"
            value={actor}
            onChange={(s) => {
              setActor(s);
              localStorage.setItem("acronym-author", s);
            }}
            hint="Recorded as author; identity is not verified."
          />
          <button
            className="secondary"
            onClick={() => navigate(() => void create(false))}
          >
            ＋ New assessment
          </button>
          <button
            className="quiet"
            onClick={() => navigate(() => void create(true))}
          >
            Create synthetic demo
          </button>
        </div>
      </aside>
      <main id="main" tabIndex={-1}>
        <header>
          <div className="breadcrumb">
            WORKSPACE <span>/</span>{" "}
            {a?.product.details.product || "Get started"}
          </div>
          <div className="header-meta">
            {a?.synthetic && <Badge>Synthetic demonstration</Badge>}
            <Badge>Local single-user prototype</Badge>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">EVIDENCE FIRST. HUMAN REVIEWED.</p>
              <h1>{a ? tab : "Prepare with confidence."}</h1>
              <p className="lead">
                {a
                  ? {
                      Overview:
                        "A clear view of your assessment, from open questions to reviewed responses.",
                      "Product setup":
                        "Describe what your product does. Confirm facts as you learn them.",
                      Evidence: "Keep source material organized and traceable.",
                      Questionnaire:
                        "Turn product knowledge into precise, supported responses.",
                      Accessibility:
                        "Record what you tested, what happened, and what remains unknown.",
                      "Review queue": "A human decision at every approval.",
                      Exports:
                        "Create a fixed, editable record of the assessment.",
                    }[tab]
                  : "Bring product details, evidence, security responses, and accessibility findings into one local workspace."}
              </p>
            </div>
            {a && <span className="revision">Saved revision {a.revision}</span>}
          </div>
          <div role="status" aria-live="polite">
            {message && <div className="notice success">{message}</div>}
            {busy && <div className="notice">Saving…</div>}
          </div>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          {dirty && (
            <p className="unsaved">
              Unsaved edits — use the save button in this section.
            </p>
          )}
          {!a ? (
            <>
              <Card title="Start with the product you know">
                <p>
                  Build an assessment from scratch, or explore a clearly labeled
                  postal-software demonstration.
                </p>
                <div className="actions">
                  <button onClick={() => void create(false)}>
                    Create assessment
                  </button>
                  <button
                    className="secondary"
                    onClick={() => void create(true)}
                  >
                    Explore synthetic demo
                  </button>
                </div>
              </Card>
              <Restore
                run={run}
                done={async (next) => {
                  setA(next);
                  await refresh();
                }}
              />
            </>
          ) : (
            <div
              onChangeCapture={(e) => {
                if ((e.target as HTMLElement).closest("form")) setDirty(true);
              }}
            >
              <fieldset
                className="workspace"
                disabled={busy}
                key={`${a.id}-${a.revision}-${tab}`}
              >
                {tab === "Overview" && <Overview a={a} go={(t) => setTab(t)} />}
                {tab === "Product setup" && <Setup {...common} />}
                {tab === "Evidence" && (
                  <EvidenceArea {...common} run={run} update={setA} />
                )}
                {tab === "Questionnaire" && <Questionnaire {...common} />}
                {tab === "Accessibility" && <Accessibility {...common} />}
                {tab === "Review queue" && <Review {...common} />}
                {tab === "Exports" && (
                  <Exports
                    a={a}
                    actor={actor}
                    run={run}
                    done={async (next) => {
                      setA(next);
                      await refresh();
                    }}
                  />
                )}
              </fieldset>
            </div>
          )}
          <footer>
            Original preparation questions and generic reports. Not an official
            HECVAT or VPAT® report. No endorsement by EDUCAUSE, ITI, or GSA.
          </footer>
        </div>
      </main>
    </div>
  );
}
type Common = {
  a: Assessment;
  actor: string;
  command: (c: unknown) => Promise<void>;
};
function Overview({ a, go }: { a: Assessment; go: (t: Tab) => void }) {
  const m = metrics(a),
    issues = outstanding(a);
  return (
    <>
      <div className="metrics">
        {[
          [`${m.answered} / ${questions.length}`, "Questions answered"],
          [`${m.reviewed} / ${questions.length}`, "Questions reviewed"],
          [String(m.testsCompleted), "Tests completed"],
          [String(m.findings), "Findings requiring attention"],
        ].map(([n, label]) => (
          <div className="metric" key={label}>
            <span>{label}</span>
            <strong>{n}</strong>
            <div className="metric-rule" />
          </div>
        ))}
      </div>
      <p className="muted">
        These measures describe documentation progress, not security,
        accessibility, or certification.
      </p>
      <div className="grid overview">
        <Card title="Your next steps">
          <div className="step">
            <span>01</span>
            <div>
              <h3>Confirm the product scope</h3>
              <p>
                Check data flows, responsibilities, and the purchaser’s
                requested standards.
              </p>
              <button
                className="text-button"
                onClick={() => go("Product setup")}
              >
                Open product setup →
              </button>
            </div>
          </div>
          <div className="step">
            <span>02</span>
            <div>
              <h3>Connect claims to sources</h3>
              <p>Use documents, test results, or a named human attestation.</p>
              <button
                className="text-button"
                onClick={() => go("Questionnaire")}
              >
                Continue questionnaire →
              </button>
            </div>
          </div>
          <div className="step">
            <span>03</span>
            <div>
              <h3>Review and capture a snapshot</h3>
              <p>
                Documented failures can belong in a completed report. Missing
                information cannot.
              </p>
              <button
                className="text-button"
                onClick={() => go("Review queue")}
              >
                Review responses →
              </button>
            </div>
          </div>
        </Card>
        <Card title="Needs your attention">
          <Badge>{issues.length} open documentation tasks</Badge>
          <ul className="issue-list">
            {issues.slice(0, 7).map((i, n) => (
              <li key={n}>{i}</li>
            ))}
          </ul>
          <details>
            <summary>View all outstanding tasks</summary>
            <ul>
              {issues.map((i, n) => (
                <li key={n}>{i}</li>
              ))}
            </ul>
          </details>
        </Card>
      </div>
      {conflicts(a).length > 0 && (
        <Card title="Conflicting statements">
          <ul>
            {conflicts(a).map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p>Clarify these statements before approving responses.</p>
        </Card>
      )}
      <Card title="A workspace for preparation">
        <p>
          External AI processing is disabled. Your work stays in the local
          database and file repository. Local storage is not encrypted by this
          application.
        </p>
        <p>
          HECVAT content and official workbook export need platform licensing
          and a verified adapter. Accessibility starter areas are an initial
          aid; they do not cover every requirement for native software.
        </p>
      </Card>
    </>
  );
}
function Setup({ a, command }: Common) {
  const [p, setP] = useState(a.product);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void command({ type: "product", value: p });
      }}
    >
      <Card title="Product and assessment">
        <p className="muted">
          “Unknown” is allowed. Unconfirmed or unknown fields become follow-up
          tasks. Confirming a field means you have checked the description, not
          that a control is compliant.
        </p>
        <div className="grid two">
          {Object.entries(productFields).map(([key, title]) => (
            <div className="setup-field" key={key}>
              <Field
                label={title}
                value={p.details[key as ProductKey]}
                multiline={
                  ![
                    "vendor",
                    "product",
                    "version",
                    "assessmentDate",
                    "owner",
                    "contact",
                    "level",
                    "edition",
                  ].includes(key)
                }
                onChange={(value) =>
                  setP({
                    ...p,
                    details: { ...p.details, [key]: value },
                    confirmed: p.confirmed.filter((k) => k !== key),
                  })
                }
              />
              <Check
                label={`${title} confirmed`}
                checked={p.confirmed.includes(key as ProductKey)}
                onChange={(checked) =>
                  setP({
                    ...p,
                    confirmed: checked
                      ? [...p.confirmed, key as ProductKey]
                      : p.confirmed.filter((k) => k !== key),
                  })
                }
              />
            </div>
          ))}
        </div>
      </Card>
      <Card title="Facts to cross-check">
        <p>
          Confirm these explicitly. No campus integrations does not establish
          that there are no external transmissions.
        </p>
        <div className="grid two">
          {Object.entries({
            externalTransmissions: "External transmissions occur",
            carrierTraffic: "Carrier service traffic occurs",
            vendorDataAccess: "Vendor personnel can access data",
            remoteAccess: "Remote support can access data",
            encryption: "Encryption provided by",
          }).map(([key, label]) => (
            <Select
              key={key}
              label={label}
              value={p.claims[key as keyof typeof p.claims]}
              onChange={(value) =>
                setP({ ...p, claims: { ...p.claims, [key]: value } })
              }
              options={
                key === "encryption"
                  ? ["Unknown", "None", "Application", "Workstation", "Both"]
                  : ["Unknown", "Yes", "No"]
              }
            />
          ))}
        </div>
        <Check
          label="I have checked that the criterion inventory covers the stated assessment scope and purchaser request."
          checked={p.criteriaInventoryConfirmed}
          onChange={(value) =>
            setP({ ...p, criteriaInventoryConfirmed: value })
          }
        />
        <p className="muted">
          Changing product details requires renewed response and criterion
          review. Native desktop scope may include software, documentation,
          support, and platform interoperability requirements beyond WCAG.
        </p>
      </Card>
      <div className="sticky-actions">
        <button type="submit">Save product setup</button>
      </div>
    </form>
  );
}
function EvidenceArea({
  a,
  actor,
  command,
  run,
  update,
}: Common & {
  run: (f: () => Promise<void>) => Promise<void>;
  update: (a: Assessment) => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [search, setSearch] = useState("");
  return (
    <>
      <Card title="Add evidence">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (!file || !actor.trim())
                throw new Error("Choose a file and enter your name.");
              const form = new FormData();
              form.append("file", file);
              form.append("actor", actor);
              form.append("revision", String(a.revision));
              const r = await fetch(`/api/assessments/${a.id}/evidence`, {
                method: "POST",
                headers: { "X-Acronym-Request": "local" },
                body: form,
              });
              const body = await r.json();
              if (!r.ok) throw new Error(body.error);
              update(body);
            });
          }}
        >
          <label className="upload">
            <strong>Choose a source document</strong>
            <span>PDF, DOCX, TXT, XLSX, CSV or TSV · up to 10 MB</span>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.xlsx,.csv,.tsv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
          </label>
          <p className="muted">
            Scanned PDFs may require OCR or a separate TXT transcription.
            Policies describe intent; they do not prove implementation. Upload
            only the material needed for this assessment.
          </p>
          <button type="submit">Upload evidence</button>
        </form>
      </Card>
      <Field
        label="Search extracted evidence"
        value={search}
        onChange={setSearch}
      />
      {a.evidence
        .filter((e) =>
          `${e.fileName} ${e.segments.map((s) => s.text).join(" ")}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .map((e) => (
          <EvidenceCard key={e.id} e={e} a={a} command={command} />
        ))}
      {!a.evidence.length && (
        <div className="empty">
          No evidence yet. Upload a policy, test report, configuration note, or
          other supporting document.
        </div>
      )}
    </>
  );
}
function EvidenceCard({
  e,
  a,
  command,
}: {
  e: Evidence;
  a: Assessment;
  command: Common["command"];
}) {
  const [v, setV] = useState({
    status: e.status,
    product: e.product,
    version: e.version,
    notes: e.notes,
    excludeFromAI: e.excludeFromAI,
  });
  const links = questions.filter((q) =>
    a.answers[q.id].references.some((r) => r.evidenceId === e.id),
  );
  return (
    <Card title={e.fileName}>
      <Badge>{e.status}</Badge> <Badge>{e.extraction}</Badge>
      <p className="muted">
        Uploaded {new Date(e.uploadedAt).toLocaleString()} ·{" "}
        <a href={`/api/assessments/${a.id}/evidence/${e.id}`}>
          Download original
        </a>
      </p>
      <details>
        <summary>Source locations and extracted text</summary>
        {e.segments.map((s) => (
          <div key={s.locator}>
            <h3>{s.locator}</h3>
            <pre className="excerpt">{s.text}</pre>
          </div>
        ))}
        {!e.segments.length && (
          <p>
            No reliable text extracted. Upload a transcription as separate
            evidence and identify its source in the notes.
          </p>
        )}
      </details>
      <p className="hash">SHA-256 {e.hash}</p>
      <p>
        Linked questions: {links.map((q) => q.id).join(", ") || "None"} · Linked
        tests:{" "}
        {a.tests
          .filter((t) => t.references.some((r) => r.evidenceId === e.id))
          .map((t) => t.workflow)
          .join(", ") || "None"}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void command({ type: "evidence", id: e.id, value: v });
        }}
      >
        <div className="grid two">
          <Select
            label="Evidence relevance"
            value={v.status}
            onChange={(status) =>
              setV({ ...v, status: status as Evidence["status"] })
            }
            options={["Current", "Uncertain", "Superseded"]}
          />
          <Field
            label="Applicable product"
            value={v.product}
            onChange={(product) => setV({ ...v, product })}
          />
          <Field
            label="Applicable version"
            value={v.version}
            onChange={(version) => setV({ ...v, version })}
          />
          <Field
            label="Relevance and source notes"
            value={v.notes}
            onChange={(notes) => setV({ ...v, notes })}
          />
        </div>
        <Check
          label="Exclude from any future external AI processing"
          checked={v.excludeFromAI}
          onChange={(excludeFromAI) => setV({ ...v, excludeFromAI })}
        />
        <button className="secondary">Save evidence details</button>
      </form>
    </Card>
  );
}
function Questionnaire(props: Common) {
  const [selected, setSelected] = useState(
      sessionStorage.getItem("acronym-question") || questions[0].id,
    ),
    [questionDirty, setQuestionDirty] = useState(false),
    [filter, setFilter] = useState("All questions");
  const visible = questions.filter(
    (q) =>
      filter === "All questions" || props.a.answers[q.id].status !== "Approved",
  );
  return (
    <div
      className="question-layout"
      onChangeCapture={(e) => {
        if ((e.target as HTMLElement).closest("form")) setQuestionDirty(true);
      }}
    >
      <div className="question-nav">
        <Select
          label="Question filter"
          value={filter}
          onChange={setFilter}
          options={["All questions", "Unanswered and unresolved"]}
        />
        {[...new Set(questions.map((q) => q.group))].map((group) => (
          <div key={group}>
            <h3>{group}</h3>
            {visible
              .filter((q) => q.group === group)
              .map((q) => (
                <button
                  aria-current={q.id === selected ? "step" : undefined}
                  key={q.id}
                  onClick={() => {
                    if (
                      questionDirty &&
                      !window.confirm("Discard unsaved changes to this answer?")
                    )
                      return;
                    setQuestionDirty(false);
                    sessionStorage.setItem("acronym-question", q.id);
                    setSelected(q.id);
                  }}
                >
                  <span>{q.id}</span>
                  {q.wording}
                  <small>{props.a.answers[q.id].status}</small>
                </button>
              ))}
          </div>
        ))}
      </div>
      <AnswerEditor {...props} id={selected} key={selected} />
    </div>
  );
}
function AnswerEditor({ a, id, actor, command }: Common & { id: string }) {
  const q = questions.find((q) => q.id === id)!,
    [v, setV] = useState({
      ...a.answers[id],
      author: a.answers[id].author || actor,
      status:
        a.answers[id].status === "Approved" ? "Draft" : a.answers[id].status,
    });
  const set = (key: string, value: unknown) => setV({ ...v, [key]: value });
  return (
    <Card>
      <Badge>Original preparation content</Badge>
      <p className="eyebrow">{q.id}</p>
      <h2>{q.wording}</h2>
      <div className="explanation">
        <h3>In plain language</h3>
        <p>{q.explanation}</p>
        <p>
          <strong>Expected response:</strong> {q.format}
        </p>
        <p>
          <strong>Useful evidence:</strong> {q.evidence}
        </p>
      </div>
      <details>
        <summary>Applicability guidance</summary>
        <p>{q.applicability}</p>
      </details>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void command({ type: "answer", id, value: v });
        }}
      >
        <div className="grid two">
          <Select
            label="Applicability"
            value={v.applicability}
            onChange={(s) => set("applicability", s)}
            options={["Applicable", "Unknown", "Not applicable"]}
          />
          <Select
            label="Response"
            value={v.response}
            onChange={(s) => set("response", s)}
            options={["", "Yes", "No", "Unknown", "Narrative"]}
          />
        </div>
        {v.applicability === "Not applicable" && (
          <>
            <Field
              label="Why this question does not apply"
              value={v.applicabilityReason}
              onChange={(s) => set("applicabilityReason", s)}
              required
              multiline
            />
            <Check
              label="A human has confirmed this applicability decision."
              checked={v.applicabilityConfirmed}
              onChange={(s) => set("applicabilityConfirmed", s)}
            />
          </>
        )}
        <Field
          label="Answer explanation"
          value={v.explanation}
          onChange={(s) => set("explanation", s)}
          multiline
        />
        <ReferenceEditor
          a={a}
          refs={v.references}
          onChange={(s) => set("references", s)}
        />
        <fieldset>
          <legend>Supporting test results</legend>
          {a.tests.length ? (
            a.tests.map((t) => (
              <Check
                key={t.id}
                label={`${t.workflow} — ${t.result}`}
                checked={v.testIds.includes(t.id)}
                onChange={(checked) =>
                  set(
                    "testIds",
                    checked
                      ? [...v.testIds, t.id]
                      : v.testIds.filter((x) => x !== t.id),
                  )
                }
              />
            ))
          ) : (
            <p className="muted">
              Record tests in the accessibility workspace to link their results.
            </p>
          )}
        </fieldset>
        <Field
          label="Human attestation"
          value={v.attestation}
          onChange={(s) => set("attestation", s)}
          multiline
          hint="A statement of firsthand knowledge, including who knows this and how. Distinct from documentary evidence."
        />
        <div className="grid two">
          <Field
            label="Answer author"
            value={v.author}
            onChange={(s) => set("author", s)}
          />
          <Select
            label="Workflow status"
            value={v.status}
            onChange={(s) => set("status", s)}
            options={[
              "Unanswered",
              "Draft",
              "Needs clarification",
              "Ready for review",
            ]}
          />
          <Field
            label="Comments"
            value={v.comments}
            onChange={(s) => set("comments", s)}
            multiline
          />
          <Field
            label="Reviewer notes"
            value={v.reviewerNotes}
            onChange={(s) => set("reviewerNotes", s)}
            multiline
          />
        </div>
        <button type="submit">Save answer</button>
      </form>
      <details>
        <summary>Answer revision history</summary>
        {a.history
          .filter((e) => (e.after as { id?: string })?.id === id)
          .map((e, i) => (
            <p key={i}>
              {e.at} · {e.actor} · {e.action}
            </p>
          ))}
      </details>
    </Card>
  );
}
function Accessibility(props: Common) {
  const { a, command } = props,
    [editing, setEditing] = useState<Test | null>(null);
  return (
    <>
      <div className="notice">
        Starter tests are an initial aid, not a complete assessment. Select and
        document the actual criteria required by the purchaser. Browser scans do
        not test native Windows applications.
      </div>
      <Card title="Original testing starters">
        <div className="grid two">
          {starters.map((s) => (
            <div key={s.id}>
              <h3>{s.title}</h3>
              <p>{s.instruction}</p>
            </div>
          ))}
        </div>
        {a.synthetic && (
          <p>
            <strong>Demo workflows:</strong> Create a shipment, edit an address,
            respond to a validation error, and print a label. Record synthetic
            findings only.
          </p>
        )}
        <p>
          For native Windows software, attach Accessibility Insights results as
          PDF, TXT, or a spreadsheet in Evidence. Record tool versions and
          assistive technologies below.
        </p>
      </Card>
      <CriterionEditor command={command} />
      {a.criteria.map((c) => (
        <CriterionCard key={c.id} c={c} command={command} actor={props.actor} />
      ))}
      <TestEditor
        {...props}
        key={editing?.id || "new"}
        existing={editing}
        done={() => setEditing(null)}
      />
      <Card title="Recorded tests">
        {a.tests.length ? (
          a.tests.map((t) => (
            <div className="test-row" key={t.id}>
              <div>
                <h3>{t.workflow}</h3>
                <p>
                  {t.screen} · {t.criterionId} · {t.tools}
                </p>
                <Badge>{t.result}</Badge>
                <p>{t.observed}</p>
                {t.findings && (
                  <p>
                    <strong>Finding:</strong> {t.findings}
                  </p>
                )}
                <p>
                  {t.tester} · {t.date}
                </p>
              </div>
              <button className="secondary" onClick={() => setEditing(t)}>
                Edit test
              </button>
            </div>
          ))
        ) : (
          <p>No recorded tests yet.</p>
        )}
      </Card>
    </>
  );
}
function CriterionEditor({
  command,
  existing,
}: {
  command: Common["command"];
  existing?: Criterion;
}) {
  const [v, setV] = useState(
    existing
      ? {
          id: existing.id,
          title: existing.title,
          standard: existing.standard,
          level: existing.level,
          scope: existing.scope,
        }
      : { id: "", title: "", standard: "", level: "", scope: "" },
  );
  return (
    <details className="card">
      <summary>
        {existing
          ? "Edit criterion scope and standard"
          : "Add an assessment criterion"}
      </summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void command({ type: "criterion", value: v });
        }}
      >
        <div className="grid two">
          {Object.entries({
            id: "Criterion identifier",
            title: "Criterion title",
            standard: "Criterion standard",
            level: "Criterion level",
            scope: "Criterion scope",
          }).map(([key, label]) => (
            <Field
              key={key}
              label={label}
              value={v[key as keyof typeof v]}
              onChange={(value) => setV({ ...v, [key]: value })}
              required
            />
          ))}
        </div>
        <p className="muted">
          Use an identifier from the requested standard when known. Updating a
          criterion clears its judgment and requires a scope inventory check.
        </p>
        <button className="secondary">Save criterion</button>
      </form>
    </details>
  );
}
function CriterionCard({
  c,
  command,
  actor,
}: {
  c: Criterion;
  command: Common["command"];
  actor: string;
}) {
  const [v, setV] = useState({
    result: "Supports",
    explanation: "",
    reviewer: actor,
    coverageConfirmed: false,
  });
  return (
    <Card title={`${c.id} · ${c.title}`}>
      <p>
        {c.standard} · {c.level} · {c.scope}
      </p>
      <Badge>{c.judgment?.result || "Needs human judgment"}</Badge>
      {c.judgment && (
        <p>
          {c.judgment.explanation} · Reviewed by {c.judgment.reviewer}
        </p>
      )}
      <CriterionEditor existing={c} command={command} />
      <details>
        <summary>Record criterion-level judgment</summary>
        <p>
          A successful test alone does not establish conformance. Evaluate the
          whole criterion across all relevant functionality. “Supports” is
          blocked when recorded tests failed or remain untested.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void command({ type: "judgment", id: c.id, value: v });
          }}
        >
          <Select
            label="Conformance judgment"
            value={v.result}
            onChange={(result) => setV({ ...v, result })}
            options={[
              "Supports",
              "Partially Supports",
              "Does Not Support",
              "Not Applicable",
            ]}
          />
          <p className="muted">
            Internal preparation terms: Supports means a method meets the
            criterion without known defects; Partially Supports identifies some
            functionality with failures; Does Not Support identifies failures in
            most functionality; Not Applicable means the criterion is irrelevant
            to the product. Official template terminology and exceptions must be
            verified in an adapter.
          </p>
          <Field
            label="Judgment explanation and coverage"
            value={v.explanation}
            onChange={(explanation) => setV({ ...v, explanation })}
            multiline
            required
          />
          <Field
            label="Criterion reviewer"
            value={v.reviewer}
            onChange={(reviewer) => setV({ ...v, reviewer })}
            required
          />
          <Check
            label="I evaluated coverage across the stated scope, beyond a single successful test, and confirm this judgment."
            checked={v.coverageConfirmed}
            onChange={(coverageConfirmed) => setV({ ...v, coverageConfirmed })}
          />
          <button className="secondary">Record judgment</button>
        </form>
      </details>
    </Card>
  );
}
function TestEditor({
  a,
  actor,
  command,
  existing,
  done,
}: Common & { existing: Test | null; done: () => void }) {
  const initial = {
    criterionId: a.criteria[0]?.id || "",
    screen: "",
    workflow: "",
    version: a.product.details.version,
    os: a.product.details.operatingSystems,
    configuration: "",
    method: "Manual",
    tools: "",
    expected: "",
    observed: "",
    tester: actor,
    date: new Date().toLocaleDateString("en-CA"),
    result: "Untested",
    references: [] as Reference[],
    findings: "",
    limitations: "",
    remediation: "",
  };
  const [v, setV] = useState(existing || initial);
  return (
    <Card
      title={
        existing ? "Edit accessibility test" : "Record an accessibility test"
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void command({
            type: "test",
            ...(existing ? { id: existing.id } : {}),
            value: v,
          }).then(done);
        }}
      >
        <label className="field">
          <span>Criterion being evaluated</span>
          <select
            value={v.criterionId}
            onChange={(e) => setV({ ...v, criterionId: e.target.value })}
          >
            {a.criteria.map((c) => (
              <option value={c.id} key={c.id}>
                {c.id} — {c.title}
              </option>
            ))}
          </select>
        </label>
        <div className="grid two">
          {Object.entries({
            screen: "Screens and controls",
            workflow: "Workflow",
            version: "Tested product version",
            os: "Operating system",
            configuration: "Test configuration",
            method: "Test method",
            tools: "Tools and assistive technologies",
            expected: "Expected behavior",
            observed: "Observed behavior",
            tester: "Tester",
            date: "Test date",
            findings: "Findings",
            limitations: "Testing limitations",
            remediation: "Remediation notes",
          }).map(([key, label]) => (
            <Field
              key={key}
              label={label}
              value={v[key as keyof typeof initial] as string}
              onChange={(value) => setV({ ...v, [key]: value })}
              multiline={[
                "observed",
                "expected",
                "findings",
                "limitations",
                "remediation",
              ].includes(key)}
              required={
                ![
                  "observed",
                  "findings",
                  "limitations",
                  "remediation",
                ].includes(key)
              }
            />
          ))}
        </div>
        <Select
          label="Test result"
          value={v.result}
          onChange={(result) =>
            setV({ ...v, result: result as Test["result"] })
          }
          options={["Untested", "Pass", "Fail", "Blocked"]}
        />
        <ReferenceEditor
          a={a}
          refs={v.references}
          onChange={(references) => setV({ ...v, references })}
        />
        <button>Save test</button>
      </form>
    </Card>
  );
}
function Review({ a, actor, command }: Common) {
  return (
    <>
      <div className="notice">
        Approval records a named human acknowledgment, not a verified identity
        or digital signature. A negative response can be approved. Unknowns and
        conflicting statements need clarification.
      </div>
      {conflicts(a).map((c) => (
        <p className="notice error" key={c}>
          {c}
        </p>
      ))}
      {questions.map((q) => (
        <ReviewItem
          key={q.id}
          qid={q.id}
          a={a}
          actor={actor}
          command={command}
        />
      ))}
    </>
  );
}
function ReviewItem({ a, actor, command, qid }: Common & { qid: string }) {
  const v = a.answers[qid],
    [reviewer, setReviewer] = useState(actor),
    [notes, setNotes] = useState(v.reviewerNotes);
  return (
    <Card title={questions.find((q) => q.id === qid)!.wording}>
      <Badge>{v.status}</Badge>
      <p>
        <strong>
          {v.applicability === "Not applicable"
            ? "Not applicable"
            : v.response || "Unanswered"}
        </strong>{" "}
        · {v.explanation || v.applicabilityReason || "No explanation recorded."}
      </p>
      <p>
        Author: {v.author || "Not recorded"} · Documents: {v.references.length}{" "}
        · Tests: {v.testIds.length}
      </p>
      {v.attestation && <p>Human attestation: {v.attestation}</p>}
      {v.references.map((r, i) => (
        <p key={i}>
          {a.evidence.find((e) => e.id === r.evidenceId)?.fileName} ·{" "}
          {r.locator} {r.quote && <q>{r.quote}</q>}
        </p>
      ))}
      {v.status === "Approved" ? (
        <p>
          Approved by {v.reviewer} on {new Date(v.reviewedAt).toLocaleString()}
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void command({ type: "approve", id: qid, reviewer, notes });
          }}
        >
          <div className="grid two">
            <Field
              label={`Reviewer for ${qid}`}
              value={reviewer}
              onChange={setReviewer}
              required
            />
            <Field
              label={`Review notes for ${qid}`}
              value={notes}
              onChange={setNotes}
            />
          </div>
          <button className="secondary">Approve {qid}</button>
        </form>
      )}
    </Card>
  );
}
function Restore({
  run,
  done,
}: {
  run: (fn: () => Promise<void>) => Promise<void>;
  done: (a: Assessment) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <Card title="Restore an assessment backup">
      <p>
        Restores a separate copy and its evidence files. Existing assessments
        are kept. Imported approvals and judgments require fresh human review.
        Previously issued exports are retained by a full local-folder backup;
        download them separately before using this portable backup.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            if (!file) throw new Error("Select a backup.");
            if (file.size > 80 * 1024 * 1024)
              throw new Error(
                "Backup exceeds 80 MB. Use full-folder recovery.",
              );
            await done(await api("/restore", JSON.parse(await file.text())));
          });
        }}
      >
        <label className="field">
          <span>Assessment backup file</span>
          <input
            type="file"
            accept=".json"
            required
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
        <button className="secondary">Restore as a copy</button>
      </form>
    </Card>
  );
}
function Exports({
  a,
  actor,
  run,
  done,
}: {
  a: Assessment;
  actor: string;
  run: (fn: () => Promise<void>) => Promise<void>;
  done: (a: Assessment) => Promise<void>;
}) {
  const [items, setItems] = useState<ExportItem[]>([]),
    [reviewer, setReviewer] = useState(actor);
  const issues = outstanding(a);
  const reload = async () =>
    setItems(await api(`/assessments/${a.id}/exports`));
  useEffect(() => {
    void reload();
  }, [a.id]);
  const create = (final: boolean) =>
    run(async () => {
      await api(`/assessments/${a.id}/exports`, {
        revision: a.revision,
        final,
        reviewer,
      });
      await reload();
    });
  return (
    <>
      <Card title="Generic assessment package">
        <p>
          One stable snapshot, two editable formats. Includes product details,
          responses, source references, accessibility findings, review history,
          and outstanding issues.
        </p>
        <div className="notice">
          Official HECVAT workbook and VPAT® ACR adapters are unsupported.
          Generic exports are clearly labeled and do not replace those official
          deliverables. JSON uses the Acronym schema, not OpenACR.
        </div>
        <Field
          label="Final report reviewer"
          value={reviewer}
          onChange={setReviewer}
        />
        <div className="actions">
          <button onClick={() => void create(false)}>
            Create draft snapshot
          </button>
          <button
            className="secondary"
            disabled={issues.length > 0}
            onClick={() => void create(true)}
          >
            Create final generic snapshot
          </button>
        </div>
        <p className="muted">
          {issues.length
            ? `${issues.length} required documentation or review tasks block final completion.`
            : "All required documentation and reviews are recorded. Failures may still need remediation."}
        </p>
        <details>
          <summary>Final completion checklist</summary>
          <ul>
            {issues.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </details>
      </Card>
      <Card title="Saved snapshots">
        {items.length ? (
          items.map((s) => (
            <div className="export-row" key={s.id}>
              <div>
                <h3>{s.status}</h3>
                <p>{new Date(s.createdAt).toLocaleString()}</p>
                <small>{s.id}</small>
              </div>
              <div className="actions">
                <a
                  className="button secondary"
                  href={`/api/exports/${s.id}/docx`}
                >
                  Download DOCX
                </a>
                <a
                  className="button secondary"
                  href={`/api/exports/${s.id}/json`}
                >
                  Download JSON
                </a>
              </div>
            </div>
          ))
        ) : (
          <p>No snapshots yet. Create a draft at any time.</p>
        )}
      </Card>
      <Card title="Portable assessment backup">
        <p>
          Includes this assessment, its revision history, and original evidence
          files. It contains sensitive local content and is not encrypted.
          Portable backups exclude issued export files; keep separate copies of
          those or back up the full data folder.
        </p>
        <a
          className="button secondary"
          href={`/api/assessments/${a.id}/backup`}
        >
          Download assessment backup
        </a>
      </Card>
      <Restore run={run} done={done} />
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
