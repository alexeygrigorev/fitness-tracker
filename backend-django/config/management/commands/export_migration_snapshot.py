import json
from datetime import date, datetime, time
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Callable

from django.core.management import BaseCommand, CommandError, call_command
from django.db import connection, transaction

from food.models import (
    FoodItem,
    Meal,
    MealFoodItem,
    MealTemplate,
    MealTemplateFoodItem,
)
from users.models import ExerciseSettings, User
from workouts.models import (
    Equipment,
    Exercise,
    ExerciseMuscleGroup,
    ExerciseTag,
    MuscleGroup,
    MuscleRegion,
    SupersetExerciseItem,
    WorkoutPlan,
    WorkoutPlanPreset,
    WorkoutPreset,
    WorkoutPresetExercise,
    WorkoutSession,
    WorkoutSet,
)


class SnapshotJSONEncoder(json.JSONEncoder):
    """Encode Django storage types into the bounded numeric JSON contract."""

    def default(self, o: Any) -> Any:
        if isinstance(o, datetime | date | time):
            return o.isoformat()
        if isinstance(o, Decimal):
            try:
                normalized = float(o.quantize(Decimal("0.01")))
            except (InvalidOperation, ValueError) as error:
                raise ValueError(f"Decimal is outside the migration range: {o}") from error
            if normalized != float(o):
                raise ValueError(f"Decimal has more than two decimal places: {o}")
            return normalized
        return super().default(o)


def source_row(instance: Any, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    row: dict[str, Any] = {"id": instance.pk}
    for field in instance._meta.concrete_fields:
        if field.primary_key or field.is_relation:
            continue
        row[field.name] = getattr(instance, field.name)
    for field in instance._meta.concrete_fields:
        if field.is_relation and field.attname.endswith("_id"):
            row[field.attname] = getattr(instance, field.attname)
    if extra:
        row.update(extra)
    return row


class Command(BaseCommand):
    help = "Export an application-owned SQLite snapshot for DynamoDB migration rehearsal."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            help="Write pretty-printed JSON here instead of stdout.",
        )

    def handle(self, *args, **options) -> None:
        if connection.vendor != "sqlite":
            raise CommandError(
                "The migration snapshot exporter only supports SQLite; "
                f"the active database is {connection.vendor}."
            )

        call_command("migrate", "--check")

        exports: list[tuple[str, Any, Callable[[Any], dict[str, Any]]]] = [
            ("users", User.objects.order_by("id"), source_row),
            ("exercise_settings", ExerciseSettings.objects.select_related(
                "user",
                "exercise",
            ).order_by("id"), source_row),
            ("muscle_regions", MuscleRegion.objects.order_by("id"), source_row),
            ("muscle_groups", MuscleGroup.objects.select_related(
                "region",
            ).order_by("id"), source_row),
            ("equipment", Equipment.objects.order_by("id"), source_row),
            ("exercise_tags", ExerciseTag.objects.order_by("id"), source_row),
            ("exercise_muscle_groups", ExerciseMuscleGroup.objects.select_related(
                "exercise",
                "muscle_group",
            ).order_by("id"), source_row),
            ("exercises", Exercise.objects.select_related(
                "user",
                "equipment",
            ).prefetch_related(
                "muscle_groups",
                "tags",
            ).order_by("id"), lambda exercise: source_row(exercise, {
                "muscle_group_names": [
                    group.name for group in exercise.muscle_groups.all().order_by("name")
                ],
                "tag_ids": [tag.id for tag in exercise.tags.all().order_by("id")],
            })),
            ("workout_presets", WorkoutPreset.objects.select_related(
                "user",
            ).order_by("id"), source_row),
            ("workout_preset_exercises", WorkoutPresetExercise.objects.select_related(
                "preset",
                "exercise",
            ).order_by("id"), lambda row: source_row(row, {
                "exercise_name": row.exercise.name if row.exercise else None,
            })),
            ("superset_exercise_items", SupersetExerciseItem.objects.select_related(
                "superset",
                "exercise",
            ).order_by("id"), lambda row: source_row(row, {
                "exercise_name": row.exercise.name,
            })),
            ("workout_plans", WorkoutPlan.objects.select_related(
                "user",
            ).order_by("id"), source_row),
            ("workout_plan_presets", WorkoutPlanPreset.objects.select_related(
                "plan",
                "preset",
            ).order_by("id"), source_row),
            ("workout_sessions", WorkoutSession.objects.select_related(
                "user",
                "preset",
            ).order_by("id"), source_row),
            ("workout_sets", WorkoutSet.objects.select_related(
                "session",
                "exercise",
            ).order_by("id"), source_row),
            ("food_items", FoodItem.objects.select_related(
                "user",
            ).order_by("id"), source_row),
            ("meals", Meal.objects.select_related(
                "user",
            ).order_by("id"), source_row),
            ("meal_food_items", MealFoodItem.objects.select_related(
                "meal",
                "food",
            ).order_by("id"), source_row),
            ("meal_templates", MealTemplate.objects.select_related(
                "user",
            ).order_by("id"), source_row),
            ("meal_template_food_items", MealTemplateFoodItem.objects.select_related(
                "template",
                "food",
            ).order_by("id"), source_row),
        ]

        # One read transaction gives all application rows the same point-in-time view.
        with transaction.atomic():
            tables = {
                name: [exporter(instance) for instance in queryset]
                for name, queryset, exporter in exports
            }

        snapshot = {
            "schemaVersion": 1,
            "sourceEngine": "django-sqlite",
            "sourceSchema": "django-current",
            "counts": {name: len(rows) for name, rows in tables.items()},
            "tables": tables,
        }
        rendered = json.dumps(
            snapshot,
            cls=SnapshotJSONEncoder,
            indent=2,
            sort_keys=True,
        ) + "\n"

        destination = options["output"]
        if destination:
            path = Path(destination)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(rendered, encoding="utf-8")
            self.stdout.write(self.style.SUCCESS(f"Wrote migration snapshot to {path}"))
        else:
            self.stdout.write(rendered)
