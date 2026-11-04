"""Read-only diagnostics using the app's existing GitHub/Azure deployment identity.

No personal login, resource mutations, credentials, raw logs, or response bodies
are printed. All Azure CLI commands are show/list operations scoped to this app.
"""
import json
import os
import re
import subprocess
from urllib.error import HTTPError, URLError
from urllib.request import Request, HTTPRedirectHandler, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def report(label, value):
    print(json.dumps({"check": label, "result": value}), flush=True)


def az(label, arguments):
    try:
        result = subprocess.run(
            ["az", *arguments, "--only-show-errors", "--output", "json"],
            capture_output=True, text=True, timeout=90,
        )
    except subprocess.TimeoutExpired:
        report(label, {"error": "timeout"})
        return None
    if result.returncode:
        # Report only recognized error classes, never CLI response text.
        signals = [s for s in ("503", "403", "401", "AuthorizationFailed",
                   "ResourceNotFound", "Service Unavailable", "Forbidden")
                   if s.lower() in result.stderr.lower()]
        report(label, {"error": "Azure read failed", "signals": signals})
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        report(label, {"error": "Unexpected response format"})
        return None


def probe(label, hostname, path):
    if not re.fullmatch(r"[a-z0-9.-]+\.azurewebsites\.net", hostname or ""):
        report(label, {"error": "No verified Azure app hostname"})
        return
    try:
        # No credentials and no following redirects to an external login page.
        response = build_opener(NoRedirect).open(
            Request(f"https://{hostname}{path}", method="GET"), timeout=25)
        with response:
            report(label, {"status": response.status,
                           "json": response.headers.get_content_type() == "application/json"})
    except HTTPError as error:
        report(label, {"status": error.code})
    except (URLError, TimeoutError):
        report(label, {"error": "Connection failed or timed out"})


def main():
    with open("app-portal/deployment-manifest.json") as source:
        manifest = json.load(source)
    group = manifest["defaults"]["azure"]["shared"]["resourceGroup"]
    name = os.environ.get("AZURE_WEBAPP_NAME", "")
    if not name:
        raise SystemExit("AZURE_WEBAPP_NAME is unavailable; no Azure reads attempted.")
    scope = ["--resource-group", group, "--name", name]
    app = az("app", ["webapp", "show", *scope])
    if not app:
        return
    report("app", {key: app.get(key) for key in
                   ("state", "availabilityState", "enabled", "httpsOnly",
                    "publicNetworkAccess", "reserved", "usageState")})
    config = az("configuration", ["webapp", "config", "show", *scope])
    if config:
        command = config.get("appCommandLine")
        report("configuration", {
            "runtime": config.get("linuxFxVersion") if re.fullmatch(
                r"NODE\|[0-9a-z.-]+", config.get("linuxFxVersion") or "") else "custom (omitted)",
            "startup": command if command in ("npm start", "", None) else "custom (omitted)",
            "alwaysOn": config.get("alwaysOn"),
            "healthCheckPath": config.get("healthCheckPath"),
            "numberOfWorkers": config.get("numberOfWorkers"),
            "scmUsesMainRestrictions": config.get("scmIpSecurityRestrictionsUseMain"),
            "scmRestrictionActions": [x.get("action") for x in config.get("scmIpSecurityRestrictions", [])],
        })
    plan_id = app.get("serverFarmId")
    if plan_id:
        plan = az("plan", ["appservice", "plan", "show", "--ids", plan_id])
        if plan:
            report("plan", {"status": plan.get("status"), "sku": plan.get("sku"),
                            "numberOfWorkers": plan.get("numberOfWorkers")})
    deployments = az("deployment history", ["webapp", "log", "deployment", "list", *scope])
    if isinstance(deployments, list):
        report("deployment history", [{k: d.get(k) for k in
                ("status", "complete", "active", "received_time", "start_time", "end_time")}
                for d in deployments[:5]])
    logs = az("deployment log", ["webapp", "log", "deployment", "show", *scope])
    if isinstance(logs, list):
        patterns = ("503", "Service Unavailable", "Cannot find module", "ENOENT",
                    "EACCES", "Run npm run build", "node:sqlite", "npm ERR", "npm error",
                    "Oryx", "disk space", "timeout", "ECONNREFUSED")
        report("deployment log", [{"time": row.get("log_time"), "type": row.get("type"),
                "signals": [p for p in patterns if p.lower() in str(row.get("message", "")).lower()]}
                for row in logs[-30:]])
    probe("public health", app.get("defaultHostName"), "/api/health")
    scm = next((h for h in app.get("enabledHostNames", []) if ".scm." in h), None)
    if scm:
        probe("deployment service", scm, "/api/deployments")


if __name__ == "__main__":
    main()
