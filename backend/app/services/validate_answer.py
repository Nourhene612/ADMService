from __future__ import annotations

import re
from typing import Any

from app.models.adm_assessment_question import AdmAssessmentQuestion


def _get_answer_value(answer: Any) -> Any:
    for field in (
        "response_string",
        "response_number",
        "response_boolean",
        "response_list_json",
        "response_object_json",
    ):
        value = getattr(answer, field, None)
        if value is not None:
            return value
    return None


def _evaluate_dependency(actual: Any, expected: Any, operator: str) -> bool:
    """Opérateurs alignés sur ConditionOperator (schéma question.py) :
    eq, neq, gt, lt, gte, lte, in, exists, not_exists.
    """
    if operator == "exists":
        return actual is not None
    if operator == "not_exists":
        return actual is None
    if operator == "eq":
        return actual == expected
    if operator == "neq":
        return actual != expected
    if operator == "in":
        return actual in expected if isinstance(expected, (list, tuple, set)) else False
    if operator == "gt":
        return actual is not None and expected is not None and actual > expected
    if operator == "lt":
        return actual is not None and expected is not None and actual < expected
    if operator == "gte":
        return actual is not None and expected is not None and actual >= expected
    if operator == "lte":
        return actual is not None and expected is not None and actual <= expected
    return False


def validate_answer(
    question: AdmAssessmentQuestion,
    payload,
    answers_by_ref: dict[str, Any] | None = None,
) -> tuple[bool, str | None]:
    #Valide une réponse selon le type, les options, les unités et les dépendances
    answers_by_ref = answers_by_ref or {}
    rules = question.validation_rules_json or {}

    # 1. Champ requis
    if question.is_required:
        all_empty = all(
            v is None
            for v in (
                payload.response_string,
                payload.response_number,
                payload.response_boolean,
                payload.response_list_json,
                payload.response_object_json,
            )
        )
        if all_empty:
            return False, "Cette question est obligatoire."

    # 2. Validation du type de réponse attendu
    if question.answer_type == "number":
        if payload.response_number is None:
            return False, "Une valeur numérique est requise."
    elif question.answer_type == "boolean":
        if payload.response_boolean is None:
            return False, "Une valeur booléenne est requise."
    elif question.answer_type in ("text", "select"):
        if not payload.response_string:
            return False, "Une valeur texte est requise."
    elif question.answer_type == "multi_select":
        if payload.response_list_json is None or not isinstance(payload.response_list_json, list):
            return False, "Une liste de valeurs est requise."
    elif question.answer_type == "object":
        if payload.response_object_json is None or not isinstance(payload.response_object_json, dict):
            return False, "Un objet JSON est requis."
    elif question.answer_type == "list":
        if payload.response_list_json is None or not isinstance(payload.response_list_json, list):
            return False, "Une liste JSON est requise."

    # 3. Validation des unités autorisées
    allowed_units = [
        u.get("value") if isinstance(u, dict) else u
        for u in (question.answer_unit_json or [])
    ]
    if allowed_units:
        if not payload.answer_unit:
            return False, "Une unité est requise pour cette question."
        if payload.answer_unit not in allowed_units:
            return False, "L'unité fournie n'est pas autorisée."

    # 4. Validation des options possibles
    if question.answer_options_json:
        allowed_values = [
            opt.get("value") if isinstance(opt, dict) else opt
            for opt in question.answer_options_json
        ]

        if question.answer_type == "select" and payload.response_string:
            if allowed_values and payload.response_string not in allowed_values:
                return False, "La valeur doit être l'une des options autorisées."

        if question.answer_type == "multi_select" and payload.response_list_json is not None:
            invalid_values = [
                v for v in payload.response_list_json if v not in allowed_values
            ]
            if invalid_values:
                return False, "Certaines valeurs ne figurent pas parmi les options autorisées."

    # 5. Validation des règles supplémentaires
    if question.answer_type == "number" and payload.response_number is not None:
        min_value = rules.get("min_value", rules.get("min"))
        max_value = rules.get("max_value", rules.get("max"))
        if min_value is not None and payload.response_number < min_value:
            return False, f"La valeur doit être supérieure ou égale à {min_value}."
        if max_value is not None and payload.response_number > max_value:
            return False, f"La valeur doit être inférieure ou égale à {max_value}."

    if question.answer_type == "text" and payload.response_string:
        min_length = rules.get("min_length")
        max_length = rules.get("max_length")
        pattern = rules.get("pattern")
        if min_length is not None and len(payload.response_string) < min_length:
            return False, f"Le texte doit contenir au moins {min_length} caractères."
        if max_length is not None and len(payload.response_string) > max_length:
            return False, f"Le texte ne doit pas dépasser {max_length} caractères."
        if pattern is not None and not re.match(pattern, payload.response_string):
            return False, "Le texte ne correspond pas au format attendu."

    # 6. Validation des dépendances entre questions
    