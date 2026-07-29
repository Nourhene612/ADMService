from datetime import datetime
from enum import Enum
from typing import List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.answer import AdmAssessmentAnswerRead


# ---------------------------------------------------------------------------
# 1. Answer type enum (was implicitly a free string before)
# ---------------------------------------------------------------------------
class AnswerType(str, Enum):
    TEXT = "text"
    TEXTAREA = "textarea"
    NUMBER = "number"
    BOOLEAN = "boolean"
    DATE = "date"
    DATETIME = "datetime"
    SELECT = "select"          # single choice from options
    MULTI_SELECT = "multi_select"  # multiple choices from options
    RADIO = "radio"
    CHECKBOX = "checkbox"



# ---------------------------------------------------------------------------
# 3. answer_unit_json -> AnswerUnit
#    Used by NUMBER (and could extend to DATE ranges etc.)
# ---------------------------------------------------------------------------
#class AnswerUnit(BaseModel):
    #unit_label: str                     # e.g. "kg", "years", "%"
    #min_value: Optional[float] = None
    #max_value: Optional[float] = None
    


# ---------------------------------------------------------------------------
# 4. Shared condition building blocks, used by both
#    dependency_json and visibility_condition_json
# ---------------------------------------------------------------------------
class ConditionOperator(str, Enum):
    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    GREATER_THAN = "gt"
    LESS_THAN = "lt"
    GREATER_OR_EQUAL = "gte"
    LESS_OR_EQUAL = "lte"
    IN = "in"
    NOT_IN = "not_in"
    INCLUDES = "includes"          # for multi_select fields: value is present
    NOT_INCLUDES = "not_includes"  # for multi_select fields: value is absent
    IS_EMPTY = "is_empty"
    IS_NOT_EMPTY = "is_not_empty"



class SimpleCondition(BaseModel):
    question_ref: str  # the OTHER question this condition reads from
    operator: ConditionOperator
    value: Optional[Union[str, float, bool, List[str]]] = None


DependencyConfig = SimpleCondition
VisibilityCondition = SimpleCondition


# ---------------------------------------------------------------------------
# 7. validation_rules_json -> ValidationRules
# ---------------------------------------------------------------------------
class ValidationRules(BaseModel):
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    regex_pattern: Optional[str] = None
    regex_error_message: Optional[str] = None
    required_if: Optional[SimpleCondition] = None


# ---------------------------------------------------------------------------
# 8. default_value_json
#    The actual value type depends on answer_type, so a Union is the
#    honest typing here rather than a fixed model.
# ---------------------------------------------------------------------------
DefaultValue = Union[str, float, bool, List[str], None]


# ---------------------------------------------------------------------------
# Putting it together
# ---------------------------------------------------------------------------
class AdmAssessmentQuestionBase(BaseModel):
    question_ref: str
    question_text: str
    question_description: Optional[str] = None
    section_key: str
    subsection_key: Optional[str] = None
    display_order: int = 0

    answer_type: AnswerType
    answer_condition: Optional[str] = None

    answer_options_json: Optional[List[str]] = None
    answer_unit_json: Optional[List[str]] = None
    dependency_json: Optional[DependencyConfig] = None

    input_placeholder: Optional[str] = None
    help_text: Optional[str] = None

    validation_rules_json: Optional[ValidationRules] = None
    visibility_condition_json: Optional[VisibilityCondition] = None
    default_value_json: Optional[DefaultValue] = None

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

    model_config = ConfigDict(from_attributes=True)


class QuestionForFormRead(AdmAssessmentQuestionRead):
    current_answer: Optional[AdmAssessmentAnswerRead] = None
    is_visible: bool = True


class QuestionsForFormResponse(BaseModel):
    session_uid: str
    sections: dict[str, dict[str, list[QuestionForFormRead]]]

    model_config = ConfigDict(from_attributes=True)