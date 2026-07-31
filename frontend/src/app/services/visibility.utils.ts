// Port TypeScript de app/services/visibility.py (evaluate_condition / evaluate_visibility)
// Doit rester synchronisé avec le backend si la logique de conditions change.

export enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'gt',
  LESS_THAN = 'lt',
  GREATER_OR_EQUAL = 'gte',
  LESS_OR_EQUAL = 'lte',
  IN = 'in',
  NOT_IN = 'not_in',
  INCLUDES = 'includes',
  NOT_INCLUDES = 'not_includes',
  IS_EMPTY = 'is_empty',
  IS_NOT_EMPTY = 'is_not_empty',
}

export interface SimpleCondition {
  question_ref: string;
  operator: ConditionOperator;
  value?: any;
}

function isEmptyValue(value: any): boolean {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

function parseBooleanLike(value: any): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['yes', 'oui', 'true', '1'].includes(normalized)) {
      return true;
    }
    if (['no', 'non', 'false', '0'].includes(normalized)) {
      return false;
    }
  }
  return undefined;
}

export function evaluateCondition(
  condition: SimpleCondition,
  answersByQuestionRef: Record<string, any>
): boolean {
  const { question_ref, operator, value } = condition;
  const answer = answersByQuestionRef[question_ref];
  const booleanAnswer = parseBooleanLike(answer);
  const booleanValue = parseBooleanLike(value);

  if (operator === ConditionOperator.IS_EMPTY) {
    return isEmptyValue(answer);
  }
  if (operator === ConditionOperator.IS_NOT_EMPTY) {
    return !isEmptyValue(answer);
  }

  // Pour les autres opérateurs, il faut une réponse existante
  if (answer === null || answer === undefined) {
    return false;
  }

  try {
    switch (operator) {
      case ConditionOperator.EQUALS:
        if (booleanAnswer !== undefined && booleanValue !== undefined) {
          return booleanAnswer === booleanValue;
        }
        return answer === value;

      case ConditionOperator.NOT_EQUALS:
        if (booleanAnswer !== undefined && booleanValue !== undefined) {
          return booleanAnswer !== booleanValue;
        }
        return answer !== value;

      case ConditionOperator.GREATER_THAN:
        return parseFloat(answer) > parseFloat(value);

      case ConditionOperator.LESS_THAN:
        return parseFloat(answer) < parseFloat(value);

      case ConditionOperator.GREATER_OR_EQUAL:
        return parseFloat(answer) >= parseFloat(value);

      case ConditionOperator.LESS_OR_EQUAL:
        return parseFloat(answer) <= parseFloat(value);

      case ConditionOperator.IN: {
        if (Array.isArray(answer)) {
          if (Array.isArray(value)) {
            return answer.some((item) => value.includes(item));
          }
          return answer.includes(value);
        }
        if (booleanAnswer !== undefined && Array.isArray(value)) {
          return value.some((item) => parseBooleanLike(item) === booleanAnswer);
        }
        return Array.isArray(value) ? value.includes(answer) : answer === value;
      }

      case ConditionOperator.NOT_IN: {
        if (Array.isArray(answer)) {
          if (Array.isArray(value)) {
            return !answer.some((item) => value.includes(item));
          }
          return !answer.includes(value);
        }
        if (booleanAnswer !== undefined && Array.isArray(value)) {
          return !value.some((item) => parseBooleanLike(item) === booleanAnswer);
        }
        return Array.isArray(value) ? !value.includes(answer) : answer !== value;
      }

      case ConditionOperator.INCLUDES:
        // answer est une liste (multi_select) qui doit contenir value
        return Array.isArray(answer)
          ? answer.includes(value)
          : String(answer).includes(String(value));

      case ConditionOperator.NOT_INCLUDES:
        return Array.isArray(answer)
          ? !answer.includes(value)
          : !String(answer).includes(String(value));

      default:
        return false;
    }
  } catch {
    return false;
  }
}

export function evaluateVisibility(
  question: { visibility_condition_json?: any; dependency_json?: any },
  answersByQuestionRef: Record<string, any>
): boolean {
  const conditions = [question.visibility_condition_json, question.dependency_json];

  for (const raw of conditions) {
    if (!raw) continue;
    const condition = raw as SimpleCondition;
    if (!evaluateCondition(condition, answersByQuestionRef)) {
      return false;
    }
  }

  return true;
}