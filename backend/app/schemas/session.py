from datetime import datetime
from typing import Optional, Any
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field


class AdmAssessmentSessionStatus(str, Enum):
    draft = "draft"
    submitted = "submitted"
    cancelled = "cancelled"
    expired = "expired"


# POST /sessions/start
class AdmAssessmentSessionCreate(BaseModel):
    customer_uid: str
    company_uid: Optional[str] = None
    assessment_type: str
    metadata_json: Optional[Any] = None


# POST /sessions/{uid}/save-draft
class AdmAssessmentSessionSaveDraft(BaseModel):
    current_step: Optional[str] = None
    completed_steps_json: Optional[Any] = None
    metadata_json: Optional[Any] = None


# POST /sessions/{uid}/submit
class AdmAssessmentSessionSubmit(BaseModel):
    submitted_by: str


# POST /sessions/{uid}/cancel
class AdmAssessmentSessionCancel(BaseModel):
    reason: Optional[str] = None
    cancelled_by: Optional[str] = None


# GET /sessions/{uid}
class AdmAssessmentSessionRead(BaseModel):
    uid: str
    customer_uid: str
    company_uid: Optional[str] = None
    assessment_type: str
    status: AdmAssessmentSessionStatus
    current_step: Optional[str] = None
    progress_percentage: int
    completed_steps_json: Optional[Any] = None
    submitted_by: Optional[str] = None
    metadata_json: Optional[Any] = None
    started_at: datetime
    updated_at: datetime
    submitted_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# GET /sessions/{uid}/progress
class AdmAssessmentSessionProgress(BaseModel):
    session_uid: str
    status: AdmAssessmentSessionStatus
    current_step: Optional[str] = None
    progress_percentage: int
    completed_steps: list[str] = Field(default_factory=list)
    total_questions: int
    answered_questions: int
    remaining_questions: int


# Résumé léger pour les listes (historique client)
class AdmAssessmentSessionSummary(BaseModel):
    uid: str
    assessment_type: str
    status: AdmAssessmentSessionStatus
    progress_percentage: int
    started_at: datetime
    submitted_at: Optional[datetime] = None



    model_config = ConfigDict(from_attributes=True)