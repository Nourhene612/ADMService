from datetime import datetime, timezone
import uuid

from sqlalchemy import (
    Column, Float, String, Boolean, DateTime, Text, ForeignKey, UniqueConstraint,
)
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.orm import relationship

from app.models.database import Base


class AdmAssessmentAnswer(Base):
    __tablename__ = "adm_assessment_answer"

    uid = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # ----------------------
    # RELATIONS (clés étrangères)
    # ----------------------
    session_uid = Column(
        String(36),
        ForeignKey("adm_assessment_session.uid", ondelete="CASCADE"),
        nullable=False,
    )
    question_uid = Column(
        String(36),
        ForeignKey("adm_assessment_question.uid"),  # pas de cascade : historique préservé
        nullable=False,
    )

    # ----------------------
    # ORM RELATIONSHIPS
    # ----------------------
    session = relationship("AdmAssessmentSession", back_populates="answers")
    question = relationship("AdmAssessmentQuestion", back_populates="answers")

    # ----------------------
    # ANSWER DATA
    # ----------------------
    answer_type = Column(String(50))
    answer_unit = Column(String(50))

    response_string = Column(Text)
    response_number = Column(Float)
    response_boolean = Column(Boolean)
    response_list_json = Column(JSON)
    response_object_json = Column(JSON)

    answer_qualifier = Column(String(100))

    is_valid = Column(Boolean, default=True)
    validation_error = Column(Text)

    answered_at = Column(DateTime)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("session_uid", "question_uid", name="uq_session_question"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"},
    )

    def __repr__(self):
        return f"<AdmAssessmentAnswer(uid={self.uid}, session_uid={self.session_uid})>"