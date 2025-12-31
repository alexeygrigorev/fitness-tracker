import os
import sys
import django
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from workouts.models import WorkoutPreset

# Update test user's presets
test_presets = WorkoutPreset.objects.filter(user__username='test')
for preset in test_presets:
    if 'Push' in preset.name:
        preset.day_label = 'Monday'
        preset.status = 'active'
        preset.tags = ['strength']
    elif 'Pull' in preset.name:
        preset.day_label = 'Wednesday'
        preset.status = 'active'
        preset.tags = ['strength']
    elif 'Leg' in preset.name:
        preset.day_label = 'Friday'
        preset.status = 'active'
        preset.tags = ['strength']
    preset.save()
    print(f"Updated {preset.name}: day_label={preset.day_label}, status={preset.status}")

print(f"\nUpdated {test_presets.count()} presets")
