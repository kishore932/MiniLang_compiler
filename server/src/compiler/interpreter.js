function coerceNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim())) {
    return Number(value);
  }
  return null;
}

function formatOutput(value) {
  if (typeof value === 'number' && Number.isInteger(value)) return String(value);
  if (typeof value === 'number') return String(value);
  return String(value);
}

function resolve(memory, value) {
  if (value === null || value === undefined) return null;
  const numeric = coerceNumber(value);
  if (numeric !== null && (typeof value === 'number' || /^-?\d+(?:\.\d+)?$/.test(String(value)))) {
    return numeric;
  }
  if (typeof value === 'string' && memory.has(value)) return memory.get(value);
  if (typeof value === 'string') return value;
  return value;
}

function isTruthy(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const numeric = coerceNumber(value);
    if (numeric !== null) return numeric !== 0;
    return value !== '' && value !== '0';
  }
  return Boolean(value);
}

function evaluate(op, left, right) {
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

export function executeTac(instructions, options = {}) {
  const maxSteps = options.maxSteps ?? 100_000;
  const program = Array.isArray(instructions) ? instructions : [];
  const memory = new Map();
  const output = [];
  const labels = new Map();

  for (let index = 0; index < program.length; index += 1) {
    const instruction = program[index];
    if (instruction?.op === 'LABEL' && instruction.arg1) {
      labels.set(instruction.arg1, index);
    }
  }

  let pointer = 0;
  let steps = 0;

  while (pointer < program.length) {
    steps += 1;
    if (steps > maxSteps) {
      return {
        ran: true,
        output,
        text: output.join('\n'),
        error: 'Execution stopped: exceeded maximum step limit.',
      };
    }

    const instruction = program[pointer] ?? {};
    const { op, arg1, arg2, result } = instruction;

    switch (op) {
      case 'LABEL':
        pointer += 1;
        break;
      case 'GOTO': {
        const target = labels.get(arg1);
        if (target === undefined) {
          return { ran: true, output, text: output.join('\n'), error: `Unknown label '${arg1}'.` };
        }
        pointer = target;
        break;
      }
      case 'IF_FALSE': {
        const condition = resolve(memory, arg1);
        if (!isTruthy(condition)) {
          const target = labels.get(arg2);
          if (target === undefined) {
            return { ran: true, output, text: output.join('\n'), error: `Unknown label '${arg2}'.` };
          }
          pointer = target;
        } else {
          pointer += 1;
        }
        break;
      }
      case 'PRINT': {
        const value = resolve(memory, arg1);
        output.push(formatOutput(value));
        pointer += 1;
        break;
      }
      case '=':
        memory.set(result, resolve(memory, arg1));
        pointer += 1;
        break;
      case 'NEGATE': {
        const value = Number(resolve(memory, arg1));
        memory.set(result, -value);
        pointer += 1;
        break;
      }
      default: {
        if (['+', '-', '*', '/', '>', '<', '>=', '<=', '==', '!='].includes(op)) {
          const left = Number(resolve(memory, arg1));
          const right = Number(resolve(memory, arg2));
          const computed = evaluate(op, left, right);
          if (computed === null) {
            return { ran: true, output, text: output.join('\n'), error: 'Division by zero.' };
          }
          memory.set(result, computed);
          pointer += 1;
          break;
        }
        pointer += 1;
      }
    }
  }

  return {
    ran: true,
    output,
    text: output.join('\n'),
    error: null,
  };
}
