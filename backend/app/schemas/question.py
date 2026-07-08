from datetime import datetime
from typing import Optional, Any
from app.schemas.answer import AdmAssessmentAnswerRead
from pydantic import BaseModel, ConfigDict, Field


class AdmAssessmentQuestionBase(BaseModel):
    question_ref: str
    question_text: str
    question_description: Optional[str] = None
    section_key: str
    subsection_key: Optional[str] = None
    display_order: int = 0
    answer_type: str
    answer_condition: Optional[str] = None
    answer_options_json: Optional[Any] = None
    answer_unit_json: Optional[Any] = None
    dependency_json: Optional[Any] = None
    input_placeholder: Optional[str] = None
    help_text: Optional[str] = None
    validation_rules_json: Optional[Any] = None
    visibility_condition_json: Optional[Any] = None
    default_value_json: Optional[Any] = None
    is_required: bool = False
    is_active: bool = True
    score_weight: Optional[float] = 0


# POST /admin/questions
class AdmAssessmentQuestionCreate(AdmAssessmentQuestionBase):
    created_by: Optional[str] = None


# PUT /admin/questions/{uid}  — remplacement complet
class AdmAssessmentQuestionUpdate(AdmAssessmentQuestionBase):
    updated_by: Optional[str] = None


# PATCH /admin/questions/{uid}/status
class AdmAssessmentQuestionStatusUpdate(BaseModel):
    is_active: bool
    updated_by: Optional[str] = None


# PATCH /admin/questions/{uid}/order
class AdmAssessmentQuestionOrderUpdate(BaseModel):
    display_order: int = Field(..., ge=0)
    updated_by: Optional[str] = None


# GET /admin/questions, GET /admin/questions/{uid}, GET /sessions/{uid}/questions
class AdmAssessmentQuestionRead(AdmAssessmentQuestionBase):
    uid: str
    version: int
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime



# GET /admin/questions/grouped-by-section
class AdmAssessmentQuestionsBySection(BaseModel):
    section_key: str
    subsections: dict[str, list[AdmAssessmentQuestionRead]]
class QuestionForFormRead(AdmAssessmentQuestionRead):
    current_answer: Optional[AdmAssessmentAnswerRead] = None
    is_visible: bool = True


class QuestionsForFormResponse(BaseModel):
    session_uid: str
    sections: dict[str, dict[str, list[QuestionForFormRead]]]

    model_config = ConfigDict(from_attributes=True)