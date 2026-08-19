"""seed ADM suggestions AI prompt

Revision ID: b7c9d2e4f1a0
Revises: 6f23cc1be5af
Create Date: 2026-08-19 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7c9d2e4f1a0"
down_revision: Union[str, None] = "6f23cc1be5af"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PROMPT_KEY = "adm_suggestions"
PROMPT_TEXT = """
Tu es une API d'autocomplétion pour un formulaire d'évaluation technique et d'architecture SI (ADM / Due-Diligence). Ton unique rôle est de compléter le texte saisi.

ENTRÉES :
1. Question : définit la catégorie attendue.
2. Texte partiel : définit le préfixe obligatoire.

RÈGLES :
1. Chaque suggestion doit commencer par le texte partiel (casse ignorée).
2. Chaque suggestion doit correspondre exactement au type demandé par la question.
   - Pour une catégorie racine (langage, SGBD, protocole...), ne propose ni frameworks, bibliothèques, ORM, SDK, drivers ou extensions.
   - Pour des outils d'entreprise, ne propose pas de logiciels grand public.
3. Propose uniquement les produits directement utilisés pour répondre à la question. N'inclus pas les composants, modules, extensions ou outils spécialisés d'une même famille si le produit principal est déjà proposé.
4. Utilise le nom officiel actuel du produit.

FORMAT :
- Réponds uniquement avec un objet JSON valide.
- Maximum 5 suggestions, sans doublon, triées par pertinence.
- Si aucune suggestion pertinente n'existe, renvoie {"suggestions":[]}.

Réponse attendue :
{"suggestions":["Suggestion 1","Suggestion 2"]}
""".strip()


def upgrade() -> None:
    connection = op.get_bind()
    prompt_exists = connection.execute(
        sa.text(
            "SELECT 1 FROM ai_prompts "
            "WHERE prompt_key = :prompt_key AND version = 1 LIMIT 1"
        ),
        {"prompt_key": PROMPT_KEY},
    ).scalar()

    if prompt_exists:
        return

    connection.execute(
        sa.text(
            "INSERT INTO ai_prompts "
            "(uid, prompt_key, version, prompt_name, capability, provider_name, "
            "model_name, prompt, prompt_response_format, temperature, "
            "max_output_tokens, response_schema_json, status, is_active, "
            "created_at, updated_at) "
            "VALUES (:uid, :prompt_key, 1, :prompt_name, :capability, "
            ":provider_name, :model_name, :prompt, :response_format, "
            ":temperature, :max_output_tokens, :response_schema, :status, "
            ":is_active, UTC_TIMESTAMP(), UTC_TIMESTAMP())"
        ),
        {
            "uid": "adm-suggestions-v1",
            "prompt_key": PROMPT_KEY,
            "prompt_name": "ADM suggestions completion",
            "capability": PROMPT_KEY,
            "provider_name": "google",
            "model_name": "gemini-2.5-flash",
            "prompt": PROMPT_TEXT,
            "response_format": "json",
            "temperature": 0,
            "max_output_tokens": 800,
            "response_schema": '{"type":"object","properties":{"suggestions":{"type":"array","items":{"type":"string"}}}}',
            "status": "ACTIVE",
            "is_active": True,
        },
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "DELETE FROM ai_prompts "
            "WHERE prompt_key = :prompt_key AND version = 1"
        ),
        {"prompt_key": PROMPT_KEY},
    )