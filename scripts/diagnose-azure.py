"""Read-only diagnostics using the app's existing GitHub/Azure deployment identity.

No personal login, resource mutations, credentials, raw logs, or response bodies
are printed. All Azure CLI commands are show/list operations scoped to this app.
"""
import json
import os
import re
import subprocess
import tempfile
import zipfile
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
                   "ResourceNotFound", "Service Unavailable", "Forbidden", "misspelled or not recognized", "unrecognized arguments")
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
    if app.get("id"):
        health = az("Azure resource health", ["rest", "--method", "GET", "--url",
            "https://management.azure.com" + app["id"] +
            "/providers/Microsoft.ResourceHealth/availabilityStatuses/current?api-version=2025-05-01"])
        if health:
            properties = health.get("properties", {})
            report("Azure resource health", {k: properties.get(k) for k in
                ("availabilityState", "reasonType", "reportedTime", "occuredTime")})
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
    settings = az("startup settings", ["webapp", "config", "appsettings", "list", *scope,
        "--query", "[?name=='NODE_ENV' || name=='SCM_DO_BUILD_DURING_DEPLOYMENT' || name=='WEBSITES_ENABLE_APP_SERVICE_STORAGE' || name=='CU_PDF_FONT_DIR'].{name:name,value:value}"])
    if isinstance(settings, list):
        # Emit only standard boolean/mode values. Font paths never leave the runner.
        report("startup settings", [{"name": s["name"], "value": s.get("value")
            if s["name"] != "CU_PDF_FONT_DIR" and s.get("value") in
            ("true", "false", "1", "0", "production", "development")
            else "configured (value omitted)"} for s in settings])
    runtimes = az("node runtime support", ["webapp", "list-runtimes", "--os", "linux"])
    if isinstance(runtimes, list):
        report("node runtime support", [r for r in runtimes if isinstance(r, str) and re.match(r"(?i)^node[:|]", r)])
    startup = az("startup log", ["webapp", "log", "startup", "show", *scope])
    if startup:
        text = json.dumps(startup).lower()
        report("startup log", {"signals": [p for p in ("Run npm run build", "Cannot find module",
            "node:sqlite", "ERR_MODULE_NOT_FOUND", "ENOENT", "EACCES", "ENOSPC", "out of memory",
            "npm error", "npm ERR", "didn't respond to HTTP pings", "failed to start", "failed to pull image",
            "ImagePullFailure", "local only, AI disabled", "CU_PDF_FONT_DIR", "typekit", "503") if p.lower() in text]})
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
    # Download existing logs only; logging is not enabled or changed here.
    with tempfile.TemporaryDirectory() as directory:
        archive = os.path.join(directory, "logs.zip")
        try:
            result = subprocess.run(["az", "webapp", "log", "download", *scope,
                "--log-file", archive, "--only-show-errors"], capture_output=True, text=True, timeout=90)
            if result.returncode or not os.path.isfile(archive):
                report("container logs", {"error": "Log download unavailable",
                    "signals": [s for s in ("503", "403", "401", "Service Unavailable") if s.lower() in result.stderr.lower()]})
            else:
                patterns = ("Run npm run build", "Cannot find module", "node:sqlite", "ERR_MODULE_NOT_FOUND",
                    "ENOENT", "EACCES", "ENOSPC", "out of memory", "npm error", "npm ERR",
                    "didn't respond to HTTP pings", "failed to start", "failed to pull image", "ImagePullFailure",
                    "local only, AI disabled", "CU_PDF_FONT_DIR", "typekit", "503")
                findings = []
                with zipfile.ZipFile(archive) as logs:
                    for entry in logs.infolist():
                        if entry.file_size > 5_000_000 or not entry.filename.lower().endswith((".log", ".txt")):
                            continue
                        text = logs.read(entry).decode("utf-8", errors="replace")
                        signals = [p for p in patterns if p.lower() in text.lower()]
                        if signals:
                            findings.append({"kind": "container" if "docker" in entry.filename.lower() else "other", "signals": signals})
                report("container logs", {"matchedFiles": findings[-20:]})
        except subprocess.TimeoutExpired:
            report("container logs", {"error": "Log download timed out"})
        except (OSError, zipfile.BadZipFile):
            report("container logs", {"error": "Logs could not be inspected"})


if __name__ == "__main__":
    main()
