"""
prompt.py

Service de complétion contextuelle pour le formulaire ADM.
Construit le prompt, appelle le modèle Gemini, valide et renvoie
une liste de suggestions structurée pour le frontend.
"""

import json
import logging
import os
from typing import List, Optional

import google.generativeai as genai

logger = logging.getLogger(__name__)


genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))

MODEL = os.environ.get("GEMINI_CHAT_MODEL", "gemini-2.5-flash")
MAX_SUGGESTIONS = 5


SYSTEM_PROMPT = """
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
"""

def _build_user_message(question: str, partial_answer: str, category: Optional[str]) -> str:
    payload = {
        "question": question,
        "partial_answer": partial_answer,
    }
    if category:
        payload["category"] = category
    return json.dumps(payload, ensure_ascii=False)
 
 
def _parse_suggestions(raw_text: str) -> List[str]:
    """
    Parsing défensif de la réponse du modèle.
    Extrait le JSON même si Gemini ajoute du texte autour.
    Retourne [] en cas de format invalide.
    """
    try:
        if not raw_text or not raw_text.strip():
            return []
 
        cleaned = raw_text.strip()
 
        # Supprimer les balises markdown éventuelles
        if "```" in cleaned:
            cleaned = cleaned.replace("```json", "")
            cleaned = cleaned.replace("```", "")
            cleaned = cleaned.strip()
 
        # Extraire uniquement l'objet JSON
        start = cleaned.find("{")
        end = cleaned.rfind("}")
 
        if start == -1 or end == -1 or start > end:
            logger.warning(
                "Aucun objet JSON trouvé dans la réponse du modèle: %r",
                raw_text,
            )
            return []
 
        cleaned = cleaned[start:end + 1]
 
        # Parser le JSON
        data = json.loads(cleaned)
 
        suggestions = data.get("suggestions", [])
 
        if not isinstance(suggestions, list):
            logger.warning(
                "Champ 'suggestions' non conforme: %r",
                suggestions,
            )
            return []
 
        # Nettoyage :
        # - uniquement des strings
        # - suppression des espaces
        # - suppression des doublons
        # - maximum MAX_SUGGESTIONS
        result = []
        seen = set()
 
        for item in suggestions:
            if not isinstance(item, str):
                continue
 
            item = item.strip()
 
            if not item:
                continue
 
            if item.lower() in seen:
                continue
 
            seen.add(item.lower())
            result.append(item)
 
            if len(result) >= MAX_SUGGESTIONS:
                break
 
        return result
 
    except json.JSONDecodeError as exc:
        logger.warning(
            "Réponse du modèle non parsable en JSON: %s | raw=%r",
            exc,
            raw_text,
        )
        return []
 
    except Exception as exc:
        logger.error(
            "Erreur inattendue pendant le parsing des suggestions: %s",
            exc,
        )
        return []
 
 
def get_suggestions(
    question: str,
    partial_answer: str,
    category: Optional[str] = None,
) -> List[str]:
    """
    Appelle le modèle pour obtenir des suggestions de complétion contextuelle.
 
    Args:
        question: la question complète du formulaire ADM.
        partial_answer: le texte déjà saisi par l'utilisateur.
        category: catégorie optionnelle de la question (ex. "cloud", "identité", "CI/CD").
 
    Returns:
        Une liste de suggestions (chaînes), potentiellement vide en cas d'échec ou d'absence de correspondance fiable.
    """
    if not partial_answer or not partial_answer.strip():
        return []
 
    user_message = _build_user_message(question, partial_answer, category)
 
    try:
        model = genai.GenerativeModel(
            model_name=MODEL,
            system_instruction=SYSTEM_PROMPT,
        )
        response = model.generate_content(
            user_message,
            generation_config=genai.types.GenerationConfig(
                temperature=0,
                max_output_tokens=800,
                
                
            ),
        
        )
    except Exception as exc:  # erreurs réseau, API, etc.
        logger.error("Échec de l'appel au modèle pour la complétion ADM: %s", exc)
        return []
     
    raw_text = getattr(response, "text", "") or ""
  
    return _parse_suggestions(raw_text)
 
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
 
    tests = [
        {
            "question": "Which tools are used to manage application delivery?",
            "partial_answer": "Jen",
        },
        {
            "question": "Which tools are used for requirements and demand management?",
            "partial_answer": "GitL"
        },
        {
            "question": "Which source-code management platforms are used?",
            "partial_answer": "Ap",
        },
        {
            "question": "Which code-quality and static-analysis tools are used?",
            "partial_answer": "Son",
        },
        {
            "question": "Which functional testing tools are used?",
            "partial_answer": "Cyp",
        },
        {
            "question": "Which tools are used to manage test cases, test execution, and test results?",
            "partial_answer": "Tes",
        },
        {
            "question": "Which performance testing tools are used?",
            "partial_answer": "JMet",
        },
        {
            "question": "Which CI/CD platforms are used?",
            "partial_answer": "Git",
        },
        {
            "question": "Which systems are integrated with your ADM platform?",
            "partial_answer": "GOO"
        },
        {
            "question": "How are ADM tools integrated?",
            "partial_answer": "SOA"
        },
        {
            "question": "Which ADM reporting capabilities are used?",
            "partial_answer": "Pow",
        },
        {
            "question": "Which application technologies and programming languages are used?",
            "partial_answer": "Pyt",
        },
        {
            "question": "Which container and orchestration platforms are used?",
            "partial_answer": "Kub",
        },
        {
            "question": "Which tools are used for test-data management?",
            "partial_answer": "Del",
        },
        {
            "question": "Which deployment targets are used?",
            "partial_answer": "Azu",
        },
    ]
 
    for index, test in enumerate(tests, start=1):
        print("=" * 80)
        print(f"Test {index}")
        print(f"Question : {test['question']}")
        print(f"Saisie    : {test['partial_answer']}")
 
        suggestions = get_suggestions(
            question=test["question"],
            partial_answer=test["partial_answer"],
        )
 
        print("Suggestions :", suggestions)
 
    print("=" * 80)
 