from typing import Optional

from pydantic import BaseModel, Field

class AutocompleteRequest(BaseModel):
    question: str = Field(..., description="The assessment question")
    partial_answer: str = Field(..., description="Current text typed by the user")
    category: Optional[str] = None
class AutocompleteResponse(BaseModel):
    suggestions: list[str]