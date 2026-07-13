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
    FILE = "file"


# ---------------------------------------------------------------------------
# 2. answer_options_json -> List[AnswerOption]
#    Used by SELECT / MULTI_SELECT / RADIO / CHECKBOX
# ---------------------------------------------------------------------------
class AnswerOption(BaseModel):
    value: str
    label: str
    display_order: int = 0
    is_default: bool = False
    # room for per-option metadata (e.g. icon, color, score) without
    # reopening the schema every time product wants a tweak
    metadata: Optional[dict] = None


# ---------------------------------------------------------------------------
# 3. answer_unit_json -> AnswerUnit
#    Used by NUMBER (and could extend to DATE ranges etc.)
# ---------------------------------------------------------------------------
class AnswerUnit(BaseModel):
    unit_label: str                     # e.g. "kg", "years", "%"
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    


# ---------------------------------------------------------------------------
# 4. Shared condition building blocks, used by both
#    dependency_json and visibility_condition_json
# ---------------------------------------------------------------------------
class ConditionOperator(str, Enum):
    EQUALS = "eq"
    NOT_EQUALS = "neq"
    GREATER_THAN = "gt"
    LESS_THAN = "lt"
    GREATER_OR_EQUAL = "gte"
    LESS_OR_EQUAL = "lte"
    IN = "in"
    NOT_IN = "not_in"
    CONTAINS = "contains"
    IS_EMPTY = "is_empty"
    IS_NOT_EMPTY = "is_not_empty"


class LogicalOperator(str, Enum):
    AND = "and"
    OR = "or"


class ConditionRule(BaseModel):
    question_ref: str  # the OTHER question this rule reads from
    operator: ConditionOperator
    value: Optional[Union[str, float, bool, List[str]]] = None


class ConditionGroup(BaseModel):
    """A group of rules combined with AND/OR — supports nested groups
    so you can express e.g. (A AND B) OR C."""
    logic: LogicalOperator = LogicalOperator.AND
    rules: List[ConditionRule] = Field(default_factory=list)
    groups: List["ConditionGroup"] = Field(default_factory=list)


ConditionGroup.model_rebuild()  # needed because of the self-reference


# ---------------------------------------------------------------------------
# 5. dependency_json -> DependencyConfig
#    "this question only makes sense / is required / is enabled when ..."
# ---------------------------------------------------------------------------
class DependencyAction(str, Enum):
    SHOW = "show"
    HIDE = "hide"
    REQUIRE = "require"
    DISABLE = "disable"


class DependencyConfig(BaseModel):
    condition: ConditionGroup
    action: DependencyAction = DependencyAction.SHOW


# ---------------------------------------------------------------------------
# 6. visibility_condition_json -> just reuse ConditionGroup directly
#    (kept as a separate alias so the field name in the model stays
#    self-documenting even though it's structurally the same thing)
# ---------------------------------------------------------------------------
VisibilityCondition = ConditionGroup


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
    required_if: Optional[ConditionGroup] = None


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

    answer_options_json: Optional[List[AnswerOption]] = None
    answer_unit_json: Optional[AnswerUnit] = None
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