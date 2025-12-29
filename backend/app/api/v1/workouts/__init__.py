from fastapi import APIRouter

router = APIRouter()

from . import exercises, sessions, presets
