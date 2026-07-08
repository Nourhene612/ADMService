from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, ConfigDict, model_validator


class AdmAssessmentAnswerBase(BaseModel):
    question_uid: str
    question_ref: Optional[str] = None
    answer_type: str
    answer_unit: Optional[str] = None

    response_string: Optional[str] = None
    response_number: Optional[float] = None
    response_boolean: Optional[bool] = None
    response_list_json: Optional[Any] = None
    response_object_json: Optional[Any] = None

    answer_qualifier: Optional[str] = None

    @model_validator(mode="after")
    def check_at_least_one_response(self):
        values = [
            self.response_string,
            self.response_number,
            self.response_boolean,
            self.response_list_json,
            self.response_object_json,
        ]
        if all(v is None for v in values):
            raise ValueError("Au moins une valeur de réponse (response_*) doit être fournie.")
        return self


# POST /sessions/{uid}/answers
class AdmAssessmentAnswerCreate(AdmAssessmentAnswerBase):
    pass


# PUT /sessions/{uid}/answers/{answer_uid}
class AdmAssessmentAnswerUpdate(AdmAssessmentAnswerBase):
    pass


# POST /sessions/{uid}/answers/bulk-upsert
class AdmAssessmentAnswerBulkUpsertItem(AdmAssessmentAnswerBase):
    answer_uid: Optional[str] = None  # si fourni → update, sinon → create


class AdmAssessmentAnswerBulkUpsert(BaseModel):
    answers: list[AdmAssessmentAnswerBulkUpsertItem]


# GET /sessions/{uid}/answers, GET .../{answer_uid}
class AdmAssessmentAnswerRead(BaseModel):
    uid: str
    session_uid: str
    question_uid: str
    answer_type: str
    answer_unit: Optional[str] = None

    response_string: Optional[str] = None
    response_number: Optional[float] = None
    response_boolean: Optional[bool] = None
    response_list_json: Optional[Any] = None
    response_object_json: Optional[Any] = None

    answer_qualifier: Optional[str] = None

    is_valid: bool
    validation_error: Optional[str] = None

    answered_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdmAssessmentAnswerBulkUpsertResult(BaseModel):
    created: list[AdmAssessmentAnswerRead]
    updated: list[AdmAssessmentAnswerRead]
    errors: list[dict[str, Any]] = [] 


    model_config = ConfigDict(from_attributes=True)