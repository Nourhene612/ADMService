from datetime import datetime, timezone
import uuid

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text, Index,
)
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.orm import relationship

from app.models.database import Base


class AdmAssessmentQuestion(Base):
    __tablename__ = "adm_assessment_question"

    uid = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    question_ref = Column(String(100), unique=True, nullable=False, index=True)
    question_text = Column(Text, nullable=False)
    question_description = Column(Text)

    section_key = Column(String(100), nullable=False, index=True)
    subsection_key = Column(String(100), index=True)

    display_order = Column(Integer, default=0)

    answer_type = Column(String(50), nullable=False)
    answer_condition = Column(String(255))

    answer_options_json = Column(JSON)
    answer_unit_json = Column(JSON)
    dependency_json = Column(JSON)

    input_placeholder = Column(String(255))
    help_text = Column(Text)

    validation_rules_json = Column(JSON)
    visibility_condition_json = Column(JSON)
    default_value_json = Column(JSON)

    is_required = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    score_weight = Column(Float, default=0)
    version = Column(Integer, default=1)

    created_by = Column(String(36))
    updated_by = Column(String(36))

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ----------------------
    # RELATIONSHIPS
    # ----------------------
    answers = relationship(
        "AdmAssessmentAnswer",
        back_populates="question",
    )

    __table_args__ = (
        Index("ix_section_subsection_order", "section_key", "subsection_key", "display_order"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"},
    )

    def __repr__(self):
        return f"<AdmAssessmentQuestion(uid={self.uid}, question_ref='{self.question_ref}')>"