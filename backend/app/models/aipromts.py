import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text, UniqueConstraint, Index,
)
from sqlalchemy.dialects.mysql import CHAR, LONGTEXT, JSON

from app.models.database import Base


def _gen_uuid() -> str:
    return str(uuid.uuid4())


class AIPrompt(Base):
    __tablename__ = "ai_prompts"

    uid = Column(CHAR(36), primary_key=True, default=_gen_uuid)

    prompt_key = Column(String(120), nullable=False)
    version = Column(Integer, nullable=False, default=1)

    prompt_name = Column(String(180))
    description = Column(Text)

    capability = Column(String(80))
    provider_name = Column(String(60))
    model_name = Column(String(200))

    prompt = Column(LONGTEXT, nullable=False)
    prompt_response_format = Column(String(40))

    temperature = Column(Float)
    max_output_tokens = Column(Integer)

    variables_json = Column(JSON)
    variables_schema_json = Column(JSON)
    response_schema_json = Column(JSON)

    status = Column(String(30), default="DRAFT")
    is_active = Column(Boolean, default=False)

    created_by = Column(String(180))
    updated_by = Column(String(180))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    __table_args__ = (
        # Une seule ligne par (prompt_key, version) — permet de versionner
        # un même prompt sans collision.
        UniqueConstraint("prompt_key", "version", name="uq_ai_prompts_key_version"),
        Index("ix_ai_prompts_capability", "capability"),
        Index("ix_ai_prompts_provider_name", "provider_name"),
        Index("ix_ai_prompts_status", "status"),
        Index("ix_ai_prompts_is_active", "is_active"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"},
    )

    def __repr__(self):
        return (
            f"<AIPrompt(uid={self.uid}, prompt_key='{self.prompt_key}', "
            f"version={self.version}, status='{self.status}')>"
        )