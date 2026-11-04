import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("diagnostics", Path(__file__).parents[1] / "scripts/diagnose-azure.py")
diagnostics = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diagnostics)


class AzureDiagnosticsTests(unittest.TestCase):
    def test_only_reads_and_no_raw_logs_or_custom_commands_are_printed(self):
        private = "synthetic-sensitive-value"
        fixtures = [
            {"state": "Running", "serverFarmId": "/synthetic-plan", "defaultHostName": "synthetic.azurewebsites.net"},
            {"linuxFxVersion": "NODE|24-lts", "appCommandLine": "start --secret=" + private},
            {"status": "Ready", "sku": {"name": "synthetic"}, "numberOfWorkers": 1},
            [{"status": 3, "message": private}],
            [{"message": "Service Unavailable 503 " + private, "type": 2}],
        ]
        calls = []

        def run(args, **kwargs):
            calls.append(args)
            return SimpleNamespace(returncode=0, stdout=json.dumps(fixtures.pop(0)), stderr="")

        output = io.StringIO()
        with patch.dict(os.environ, {"AZURE_WEBAPP_NAME": "synthetic"}), \
             patch.object(diagnostics.subprocess, "run", side_effect=run), \
             patch.object(diagnostics, "probe"), contextlib.redirect_stdout(output):
            diagnostics.main()
        self.assertNotIn(private, output.getvalue())
        self.assertIn("503", output.getvalue())
        self.assertEqual([c[1:4] for c in calls[:3]], [
            ["webapp", "show", "--resource-group"], ["webapp", "config", "show"],
            ["appservice", "plan", "show"]])
        self.assertTrue(all(c[1:4] == ["webapp", "log", "deployment"] and c[4] in ("list", "show") for c in calls[3:]))

    def test_cli_error_text_is_never_emitted(self):
        output = io.StringIO()
        with patch.object(diagnostics.subprocess, "run", return_value=SimpleNamespace(
                returncode=1, stdout="", stderr="503 password=synthetic-secret")), contextlib.redirect_stdout(output):
            self.assertIsNone(diagnostics.az("test", ["webapp", "show"]))
        self.assertIn("503", output.getvalue())
        self.assertNotIn("synthetic-secret", output.getvalue())

    def test_probe_rejects_non_azure_hosts_and_redirects(self):
        output = io.StringIO()
        with patch.object(diagnostics, "build_opener") as opener, contextlib.redirect_stdout(output):
            diagnostics.probe("health", "attacker.example", "/api/health")
            opener.assert_not_called()
        self.assertIsNone(diagnostics.NoRedirect().redirect_request(None, None, 302, "", {}, "https://example.com"))


if __name__ == "__main__":
    unittest.main()
