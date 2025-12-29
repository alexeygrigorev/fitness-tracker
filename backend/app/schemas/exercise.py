from pydantic import BaseModel, Field
from typing import List, Literal, Optional


class ExerciseBase(BaseModel):
    name: str
    category: Literal["compound", "isolation"]
    muscleGroups: List[str]
    equipment: List[str]
    instructions: str


class ExerciseCreate(ExerciseBase):
    pass


class ExerciseUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[Literal["compound", "isolation"]] = None
    muscleGroups: Optional[List[str]] = None
    equipment: Optional[List[str]] = None
    instructions: Optional[str] = None


class Exercise(ExerciseBase):
    id: str

    model_config = {"from_attributes": True}
