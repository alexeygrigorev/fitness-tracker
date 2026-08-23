import json
from io import StringIO
from pathlib import Path

from django.core.management import BaseCommand, call_command


class Command(BaseCommand):
    help = "Export a deterministic OpenAPI document for TypeScript parity checks."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            help="Write pretty-printed JSON to this path instead of stdout.",
        )

    def handle(self, *args, **options):
        output = StringIO()
        call_command("spectacular", "--format", "openapi-json", stdout=output)
        document = json.loads(output.getvalue())
        rendered = json.dumps(document, indent=2, sort_keys=True) + "\n"

        destination = options["output"]
        if destination:
            path = Path(destination)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(rendered, encoding="utf-8")
            self.stdout.write(self.style.SUCCESS(f"Wrote OpenAPI contract to {path}"))
        else:
            self.stdout.write(rendered)
