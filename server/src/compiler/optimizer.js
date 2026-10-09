import { formatTacInstruction } from './intermediateCodeGenerator.js';

const ARITHMETIC_OPERATIONS = new Set(['+', '-', '*', '/']);
const COMPARISON_OPERATIONS = new Set(['>', '<', '>=', '<=', '==', '!=']);
const CONTROL_FLOW_OPS = new Set(['LABEL', 'GOTO', 'IF_FALSE']);

function coerceNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim())) {
    return Number(value);
  }
  return null;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return String(value);
  return String(value);
}

function isZero(value) {
  const numericValue = coerceNumber(value);
  return numericValue !== null && numericValue === 0;
}

function isOne(value) {
  const numericValue = coerceNumber(value);
  return numericValue !== null && numericValue === 1;
}

function isTemporary(value) {
  return typeof value === 'string' && /^t\d+$/.test(value);
}

function cloneInstruction(instruction) {
  return instruction && typeof instruction === 'object' ? { ...instruction } : instruction;
}

function recordOptimization(applied, rule, before, after) {
  if (before === after) return;
  applied.push({ rule, before, after });
}

function evaluateOperation(op, left, right) {
  switch (op) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/': return right === 0 ? null : left / right;
    case '>': return left > right ? 1 : 0;
    case '<': return left < right ? 1 : 0;
    case '>=': return left >= right ? 1 : 0;
    case '<=': return left <= right ? 1 : 0;
    case '==': return left === right ? 1 : 0;
    case '!=': return left !== right ? 1 : 0;
    default: return null;
  }
}

function substituteOperand(value, constants) {
  if (typeof value !== 'string') return { value, replaced: false };
  if (!constants.has(value)) return { value, replaced: false };
  return { value: constants.get(value), replaced: true };
}

function simplifyInstruction(instruction) {
  if (!instruction || !instruction.op) return instruction;

  if (instruction.op === '+' && (isZero(instruction.arg1) || isZero(instruction.arg2))) {
    const simplified = isZero(instruction.arg1) ? instruction.arg2 : instruction.arg1;
    return { ...instruction, op: '=', arg1: simplified, arg2: null };
  }

  if (instruction.op === '-' && isZero(instruction.arg2)) {
    return { ...instruction, op: '=', arg1: instruction.arg1, arg2: null };
  }

  if (instruction.op === '*' && (isZero(instruction.arg1) || isZero(instruction.arg2))) {
    return { ...instruction, op: '=', arg1: '0', arg2: null };
  }

  if (instruction.op === '*' && (isOne(instruction.arg1) || isOne(instruction.arg2))) {
    const simplified = isOne(instruction.arg1) ? instruction.arg2 : instruction.arg1;
    return { ...instruction, op: '=', arg1: simplified, arg2: null };
  }

  if (instruction.op === '/' && isOne(instruction.arg2)) {
    return { ...instruction, op: '=', arg1: instruction.arg1, arg2: null };
  }

  if (instruction.op === 'NEGATE') {
    const numericValue = coerceNumber(instruction.arg1);
    if (numericValue !== null) {
      return { ...instruction, op: '=', arg1: formatNumber(-numericValue), arg2: null };
    }
  }

  if (instruction.op === '=' && instruction.arg1 === instruction.result) {
    return null;
  }

  return instruction;
}

function rememberConstant(constants, name, value) {
  const numericValue = coerceNumber(value);
  if (!name || numericValue === null) {
    if (name) constants.delete(name);
    return;
  }
  constants.set(name, formatNumber(numericValue));
}

function collectUses(instruction) {
  const uses = [];
  if (typeof instruction.arg1 === 'string') uses.push(instruction.arg1);
  if (typeof instruction.arg2 === 'string') uses.push(instruction.arg2);
  return uses;
}

export function optimizeThreeAddressCode(instructions) {
  const originalInstructions = Array.isArray(instructions)
    ? instructions.map((instruction) => cloneInstruction(instruction))
    : [];
  let workingInstructions = originalInstructions.map((instruction) => cloneInstruction(instruction));
  const appliedOptimizations = [];

  let changed = true;
  let safety = 0;
  while (changed && safety < 32) {
    changed = false;
    safety += 1;
    const constants = new Map();

    for (let index = 0; index < workingInstructions.length; index += 1) {
      const currentInstruction = workingInstructions[index];
      if (!currentInstruction) continue;

      if (currentInstruction.op === 'LABEL') {
        constants.clear();
        continue;
      }

      const beforeText = formatTacInstruction(currentInstruction);
      let updatedInstruction = cloneInstruction(currentInstruction);

      const arg1Substitution = substituteOperand(updatedInstruction.arg1, constants);
      const arg2Substitution = substituteOperand(updatedInstruction.arg2, constants);
      updatedInstruction.arg1 = arg1Substitution.value;
      updatedInstruction.arg2 = arg2Substitution.value;

      if (arg1Substitution.replaced || arg2Substitution.replaced) {
        recordOptimization(
          appliedOptimizations,
          'Constant Propagation',
          beforeText,
          formatTacInstruction(updatedInstruction),
        );
        changed = true;
      }

      if (
        (ARITHMETIC_OPERATIONS.has(updatedInstruction.op) || COMPARISON_OPERATIONS.has(updatedInstruction.op))
        && coerceNumber(updatedInstruction.arg1) !== null
        && coerceNumber(updatedInstruction.arg2) !== null
      ) {
        const computed = evaluateOperation(
          updatedInstruction.op,
          Number(updatedInstruction.arg1),
          Number(updatedInstruction.arg2),
        );
        if (computed !== null) {
          const folded = {
            ...updatedInstruction,
            op: '=',
            arg1: formatNumber(computed),
            arg2: null,
          };
          recordOptimization(
            appliedOptimizations,
            'Constant Folding',
            formatTacInstruction(updatedInstruction),
            formatTacInstruction(folded),
          );
          updatedInstruction = folded;
          changed = true;
        }
      }

      const simplifiedInstruction = simplifyInstruction(updatedInstruction);
      if (simplifiedInstruction === null) {
        recordOptimization(appliedOptimizations, 'Redundant Assignment Elimination', beforeText, 'removed');
        workingInstructions[index] = null;
        changed = true;
        continue;
      }

      if (formatTacInstruction(simplifiedInstruction) !== formatTacInstruction(updatedInstruction)) {
        recordOptimization(
          appliedOptimizations,
          'Algebraic Simplification',
          formatTacInstruction(updatedInstruction),
          formatTacInstruction(simplifiedInstruction),
        );
        updatedInstruction = simplifiedInstruction;
        changed = true;
      }

      if (updatedInstruction.op === '=') {
        rememberConstant(constants, updatedInstruction.result, updatedInstruction.arg1);
      } else if (updatedInstruction.result) {
        constants.delete(updatedInstruction.result);
      }

      if (updatedInstruction.op === 'GOTO' || updatedInstruction.op === 'IF_FALSE') {
        constants.clear();
      }

      workingInstructions[index] = updatedInstruction;
    }

    workingInstructions = workingInstructions.filter((instruction) => instruction !== null);
  }

  const usedNames = new Set();
  for (const instruction of workingInstructions) {
    for (const use of collectUses(instruction)) {
      usedNames.add(use);
    }
  }

  const optimizedInstructions = [];
  for (const instruction of workingInstructions) {
    const beforeText = formatTacInstruction(instruction);

    if (
      instruction.result
      && isTemporary(instruction.result)
      && !usedNames.has(instruction.result)
      && !CONTROL_FLOW_OPS.has(instruction.op)
    ) {
      recordOptimization(appliedOptimizations, 'Dead Temporary Elimination', beforeText, 'removed');
      continue;
    }

    if (instruction.op === '=' && instruction.result && instruction.arg1 === instruction.result) {
      recordOptimization(appliedOptimizations, 'Redundant Assignment Elimination', beforeText, 'removed');
      continue;
    }

    optimizedInstructions.push({
      ...instruction,
      index: optimizedInstructions.length + 1,
    });
  }

  return {
    originalInstructions,
    optimizedInstructions,
    appliedOptimizations,
    removedInstructions: Math.max(0, originalInstructions.length - optimizedInstructions.length),
    formattedOriginal: originalInstructions.map(formatTacInstruction).join('\n'),
    formattedOptimized: optimizedInstructions.map(formatTacInstruction).join('\n'),
  };
}
