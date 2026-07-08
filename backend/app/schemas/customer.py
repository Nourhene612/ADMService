from pydantic import BaseModel
from app.schemas.session import AdmAssessmentSessionSummary


class CustomerSessionsResponse(BaseModel):
    customer_uid: str
    total: int
    sessions: list[AdmAssessmentSessionSummary]