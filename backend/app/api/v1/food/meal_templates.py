"""
Meal templates CRUD endpoints.
Reusable meal templates for quick logging.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.schemas.food import (
    MealTemplate, MealTemplateCreate, MealTemplateUpdate,
    TemplateNutritionResponse
)
from app.api.v1.food.foods import get_user_foods
from app.services.nutrition import calculate_template_nutrition

router = APIRouter()

# Mock data - replace with database later
MOCK_TEMPLATES: Dict[int, List[MealTemplate]] = {}
TEMPLATE_ID_COUNTER = 1


def get_user_templates(user_id: int) -> List[MealTemplate]:
    """Get meal templates for a specific user."""
    return MOCK_TEMPLATES.get(user_id, [])


@router.get("", response_model=List[MealTemplate])
async def get_templates(current_user: User = Depends(get_current_user)):
    """Get all meal templates for the current user."""
    return get_user_templates(current_user.id)


@router.get("/{template_id}", response_model=MealTemplate)
async def get_template(template_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific meal template by ID."""
    for template in get_user_templates(current_user.id):
        if template.id == template_id:
            return template
    raise HTTPException(status_code=404, detail="Template not found")


@router.post("", response_model=MealTemplate, status_code=201)
async def create_template(
    template: MealTemplateCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new meal template."""
    global TEMPLATE_ID_COUNTER

    new_template = MealTemplate(
        id=f"template-{TEMPLATE_ID_COUNTER}",
        name=template.name,
        category=template.category,
        foods=template.foods
    )
    TEMPLATE_ID_COUNTER += 1

    # Add to user's templates
    if current_user.id not in MOCK_TEMPLATES:
        MOCK_TEMPLATES[current_user.id] = []
    MOCK_TEMPLATES[current_user.id].append(new_template)
    return new_template


@router.patch("/{template_id}", response_model=MealTemplate)
async def update_template(
    template_id: str,
    template: MealTemplateUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a meal template."""
    if current_user.id not in MOCK_TEMPLATES:
        raise HTTPException(status_code=404, detail="Template not found")

    for i, t in enumerate(MOCK_TEMPLATES[current_user.id]):
        if t.id == template_id:
            # Update only provided fields
            update_data = template.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                setattr(MOCK_TEMPLATES[current_user.id][i], field, value)
            return MOCK_TEMPLATES[current_user.id][i]

    raise HTTPException(status_code=404, detail="Template not found")


@router.delete("/{template_id}", status_code=204)
async def delete_template(template_id: str, current_user: User = Depends(get_current_user)):
    """Delete a meal template."""
    if current_user.id not in MOCK_TEMPLATES:
        raise HTTPException(status_code=404, detail="Template not found")

    for i, t in enumerate(MOCK_TEMPLATES[current_user.id]):
        if t.id == template_id:
            MOCK_TEMPLATES[current_user.id].pop(i)
            return

    raise HTTPException(status_code=404, detail="Template not found")


@router.post("/calculate-nutrition", response_model=TemplateNutritionResponse)
async def calculate_template_nutrition_endpoint(
    template: MealTemplateCreate,
    current_user: User = Depends(get_current_user)
):
    """
    Calculate nutrition for a meal template.
    Useful for previewing nutrition before saving.
    """
    food_items = get_user_foods(current_user.id)
    totals = calculate_template_nutrition(template.foods, food_items)
    return TemplateNutritionResponse(totals=totals)
