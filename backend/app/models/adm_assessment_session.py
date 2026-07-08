from datetime import datetime, timezone
import enum
import uuid
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import Column, String, Integer, DateTime, Index
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.orm import relationship

from app.models.database import Base
class SessionStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    cancelled = "cancelled"
    expired = "expired"


class AdmAssessmentSession(Base):
    __tablename__ = "adm_assessment_session"

    uid = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    customer_uid = Column(String(36), nullable=False, index=True)
    company_uid = Column(String(36), nullable=True, index=True)

    assessment_type = Column(String(50), nullable=False, index=True)
    status = Column(SQLEnum(SessionStatus, native_enum=False, length=20), nullable=False, default=SessionStatus.draft, index=True)

    current_step = Column(String(100))
    progress_percentage = Column(Integer, default=0)

    completed_steps_json = Column(JSON)
    metadata_json = Column(JSON)

    submitted_by = Column(String(36))

    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    submitted_at = Column(DateTime)
    expires_at = Column(DateTime)

    # ----------------------
    # RELATIONSHIPS
    # ----------------------
    answers = relationship(
        "AdmAssessmentAnswer",
        back_populates="session",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_customer_status", "customer_uid", "status"),
        Index("ix_company_status", "company_uid", "status"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"},
    )

    def __repr__(self):
        return f"<AdmAssessmentSession(uid={self.uid}, status='{self.status}')>"