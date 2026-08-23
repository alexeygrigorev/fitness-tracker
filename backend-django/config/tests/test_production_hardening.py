import json
import os
import re
from pathlib import Path
import tomllib
from subprocess import run
import sys
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core.exceptions import ImproperlyConfigured
from django.db import OperationalError
from django.test import RequestFactory, TestCase, override_settings

from config.urls import serve_spa


BACKEND_DIR = Path(__file__).resolve().parents[2]
REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
PRODUCTION_SECRET = "production-secret-value-with-more-than-fifty-characters"


def load_settings(overrides):
    environment = os.environ.copy()
    controlled_names = {
        "DEBUG",
        "DJANGO_ALLOWED_HOSTS",
        "DJANGO_CSRF_TRUSTED_ORIGINS",
        "DJANGO_TRUST_PROXY_TLS",
        "FRONTEND_URL",
        "SECRET_KEY",
    }
    for name in controlled_names:
        environment.pop(name, None)
    environment.update(overrides)
    result = run(
        [
            sys.executable,
            "-c",
            (
                "import django, json; django.setup(); "
                "from django.conf import settings; "
                "print(json.dumps({"
                "'csrf': settings.CSRF_TRUSTED_ORIGINS, "
                "'cors': settings.CORS_ALLOWED_ORIGINS, "
                "'cors_credentials': settings.CORS_ALLOW_CREDENTIALS, "
                "'hsts': settings.SECURE_HSTS_SECONDS, "
                "'proxy_tls': getattr(settings, 'SECURE_PROXY_SSL_HEADER', None), "
                "'referrer': settings.SECURE_REFERRER_POLICY, "
                "'ssl_redirect': settings.SECURE_SSL_REDIRECT"
                "}))"
            ),
        ],
        cwd=BACKEND_DIR,
        env=environment,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise AssertionError(result.stderr)
    return json.loads(result.stdout)


class ProductionSettingsTests(TestCase):
    def test_fly_allowlist_contains_only_the_configured_application_host(self):
        with (REPOSITORY_ROOT / "fly.toml").open("rb") as config_file:
            config = tomllib.load(config_file)

        application_host = f"{config['app']}.fly.dev"
        self.assertEqual(config["env"]["DJANGO_ALLOWED_HOSTS"], application_host)
        self.assertEqual(config["env"]["DJANGO_CSRF_TRUSTED_ORIGINS"], f"https://{application_host}")

    def test_portable_image_defaults_to_non_debug_mode(self):
        contents = (REPOSITORY_ROOT / "Dockerfile").read_text()
        debug_directives = re.findall(r"^ENV DEBUG=(.+)$", contents, flags=re.MULTILINE)
        collectstatic_commands = [
            line
            for line in contents.splitlines()
            if re.match(r"^RUN\b", line) and "collectstatic" in line
        ]

        self.assertEqual(debug_directives, ["false"])
        self.assertEqual(len(collectstatic_commands), 1)
        self.assertIn("DEBUG=false", collectstatic_commands[0])
        self.assertIn("SECRET_KEY=", collectstatic_commands[0])
        self.assertIsNone(re.search(r"^ENV SECRET_KEY=", contents, flags=re.MULTILINE))

    def test_fly_proxy_enables_transport_hardening(self):
        values = load_settings(
            {
                "DEBUG": "false",
                "SECRET_KEY": PRODUCTION_SECRET,
                "DJANGO_ALLOWED_HOSTS": "rough-leaf-5415.fly.dev",
                "DJANGO_CSRF_TRUSTED_ORIGINS": "https://rough-leaf-5415.fly.dev",
                "DJANGO_TRUST_PROXY_TLS": "true",
            }
        )

        self.assertEqual(values["proxy_tls"], ["HTTP_X_FORWARDED_PROTO", "https"])
        self.assertTrue(values["ssl_redirect"])
        self.assertEqual(values["hsts"], 31536000)
        self.assertEqual(values["csrf"], ["https://rough-leaf-5415.fly.dev"])
        self.assertEqual(values["cors"], [])
        self.assertFalse(values["cors_credentials"])
        self.assertEqual(values["referrer"], "same-origin")

    def test_portable_direct_http_mode_does_not_redirect_health_checks(self):
        values = load_settings(
            {
                "DEBUG": "false",
                "SECRET_KEY": PRODUCTION_SECRET,
                "DJANGO_ALLOWED_HOSTS": "localhost",
            }
        )

        self.assertIsNone(values["proxy_tls"])
        self.assertFalse(values["ssl_redirect"])

    def test_debug_keeps_local_browser_origins(self):
        values = load_settings({"DEBUG": "true"})

        self.assertIn("http://localhost:5173", values["cors"])
        self.assertFalse(values["cors_credentials"])

    def test_short_production_secret_is_rejected(self):
        environment = os.environ.copy()
        environment.update(
            {
                "DEBUG": "false",
                "SECRET_KEY": "short-secret",
                "DJANGO_ALLOWED_HOSTS": "localhost",
            }
        )
        result = run(
            [sys.executable, "-c", "import config.settings"],
            cwd=BACKEND_DIR,
            env=environment,
            text=True,
            capture_output=True,
            check=False,
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("at least 50 characters", result.stderr)
        self.assertIn(ImproperlyConfigured.__name__, result.stderr)


class HealthEndpointTests(TestCase):
    def test_database_failure_is_unready(self):
        with patch("config.urls.connection.cursor", side_effect=OperationalError):
            response = self.client.get("/api/health/")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["status"], "unhealthy")


class SpaCacheTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_hashed_assets_are_immutable_and_entrypoint_is_not_stored(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            asset_dir = root / "assets"
            asset_dir.mkdir()
            (asset_dir / "app.test.js").write_text("window.test = true;\n")
            (root / "index.html").write_text("<!doctype html><title>Fitness</title>")

            with override_settings(FRONTEND_BUILD=root):
                asset = serve_spa(self.factory.get("/assets/app.test.js"), "assets/app.test.js")
                entrypoint = serve_spa(self.factory.get("/"), "")

            self.assertEqual(asset["Cache-Control"], "public, max-age=31536000, immutable")
            self.assertEqual(asset["Content-Type"], "text/javascript")
            self.assertEqual(entrypoint["Cache-Control"], "no-store, must-revalidate")
            self.assertTrue(entrypoint["Content-Type"].startswith("text/html"))
