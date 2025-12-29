from pydantic import BaseModel, Field
from typing import List, Literal, Optional


class ExerciseBase(BaseModel):
    name: str
    category: Literal["compound", "isolation", "cardio"]
    muscleGroups: List[str]
    equipment: List[str]
    instructions: List[str]
    bodyweight: Optional[bool] = False


class ExerciseCreate(ExerciseBase):
    pass


class ExerciseUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[Literal["compound", "isolation", "cardio"]] = None
    muscleGroups: Optional[List[str]] = None
    equipment: Optional[List[str]] = None
    instructions: Optional[List[str]] = None
    bodyweight: Optional[bool] = None


class Exercise(ExerciseBase):
    id: str

    model_config = {"from_attributes": True}
