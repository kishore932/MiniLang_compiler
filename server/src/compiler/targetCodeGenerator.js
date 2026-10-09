function isNumericLiteral(value) {
  if (typeof value === 'number') return true;
  if (typeof value === 'string') {
    return /^-?\d+(?:\.\d+)?$/.test(value.trim());
  }
  return false;
}

function normaliseOperand(value) {
  return value === null || value === undefined ? '' : String(value);
}

function formatMiniAsmInstruction(operation, operands) {
  const args = operands.map((operand) => normaliseOperand(operand)).filter((operand) => operand !== '');

  if (operation === 'LABEL') {
    return `${args[0]}:`;
  }

  if (operation === 'JMP') {
    return `JMP ${args[0]}`;
  }

  if (operation === 'JMP_IF_FALSE') {
    return `JMP_IF_FALSE ${args[0]}, ${args[1]}`;
  }

  if (operation === 'PRINT') {
    return `PRINT ${args[0]}`;
  }

  if (operation === 'STORE') {
    return `STORE ${args[0]}, ${args[1]}`;
  }

  if (operation === 'LOAD') {
    return `LOAD ${args[0]}, ${args[1]}`;
  }

  if (operation === 'LOADI') {
    return `LOADI ${args[0]}, ${args[1]}`;
  }

  return `${operation} ${args.join(', ')}`;
}

function emit(instructions, labels, registers, operation, ...operands) {
  const formatted = formatMiniAsmInstruction(operation, operands);
  instructions.push({ op: operation, args: operands, text: formatted });
  if (operation === 'LABEL' && operands[0]) {
    labels.push(operands[0]);
  }
  if (operands[0] && /^R\d+$/.test(String(operands[0]))) {
    registers.add(String(operands[0]));
  }
}

function emitBinaryOperation(instructions, labels, registers, mnemonic, left, right, result) {
  if (isNumericLiteral(left)) {
    emit(instructions, labels, registers, 'LOADI', 'R1', left);
  } else {
    emit(instructions, labels, registers, 'LOAD', 'R1', left);
  }

  if (isNumericLiteral(right)) {
    emit(instructions, labels, registers, 'LOADI', 'R2', right);
  } else {
    emit(instructions, labels, registers, 'LOAD', 'R2', right);
  }

  emit(instructions, labels, registers, mnemonic, 'R1', 'R2');
  emit(instructions, labels, registers, 'STORE', 'R1', result);
}

export function generateTargetCode(tacInstructions) {
  if (!Array.isArray(tacInstructions)) {
    throw new TypeError('Target code generator input must be an array of TAC instructions');
  }

  const instructions = [];
  const labels = [];
  const registers = new Set();

  for (const instruction of tacInstructions) {
    const { op, arg1, arg2, result } = instruction ?? {};

    switch (op) {
      case 'LABEL':
        emit(instructions, labels, registers, 'LABEL', arg1);
        break;
      case 'GOTO':
        emit(instructions, labels, registers, 'JMP', arg1);
        break;
      case 'IF_FALSE':
        emit(instructions, labels, registers, 'JMP_IF_FALSE', arg1, arg2);
        break;
      case 'PRINT': {
        if (isNumericLiteral(arg1)) {
          emit(instructions, labels, registers, 'LOADI', 'R1', arg1);
        } else {
          emit(instructions, labels, registers, 'LOAD', 'R1', arg1);
        }
        emit(instructions, labels, registers, 'PRINT', 'R1');
        break;
      }
      case '=': {
        if (isNumericLiteral(arg1)) {
          emit(instructions, labels, registers, 'LOADI', 'R1', arg1);
        } else if (arg1 !== null && arg1 !== undefined) {
          emit(instructions, labels, registers, 'LOAD', 'R1', arg1);
        }
        if (result !== null && result !== undefined) {
          emit(instructions, labels, registers, 'STORE', 'R1', result);
        }
        break;
      }
      case 'NEGATE': {
        if (isNumericLiteral(arg1)) {
          emit(instructions, labels, registers, 'LOADI', 'R1', arg1);
        } else {
          emit(instructions, labels, registers, 'LOAD', 'R1', arg1);
        }
        emit(instructions, labels, registers, 'NEG', 'R1');
        emit(instructions, labels, registers, 'STORE', 'R1', result);
        break;
      }
      case '+':
        emitBinaryOperation(instructions, labels, registers, 'ADD', arg1, arg2, result);
        break;
      case '-':
        emitBinaryOperation(instructions, labels, registers, 'SUB', arg1, arg2, result);
        break;
      case '*':
        emitBinaryOperation(instructions, labels, registers, 'MUL', arg1, arg2, result);
        break;
      case '/':
        emitBinaryOperation(instructions, labels, registers, 'DIV', arg1, arg2, result);
        break;
      case '>':
        emitBinaryOperation(instructions, labels, registers, 'CMP_GT', arg1, arg2, result);
        break;
      case '<':
        emitBinaryOperation(instructions, labels, registers, 'CMP_LT', arg1, arg2, result);
        break;
      case '>=':
        emitBinaryOperation(instructions, labels, registers, 'CMP_GTE', arg1, arg2, result);
        break;
      case '<=':
        emitBinaryOperation(instructions, labels, registers, 'CMP_LTE', arg1, arg2, result);
        break;
      case '==':
        emitBinaryOperation(instructions, labels, registers, 'CMP_EQ', arg1, arg2, result);
        break;
      case '!=':
        emitBinaryOperation(instructions, labels, registers, 'CMP_NEQ', arg1, arg2, result);
        break;
      default:
        if (arg1 !== null && arg1 !== undefined) {
          emit(instructions, labels, registers, 'LOAD', 'R1', arg1);
        }
        break;
    }
  }

  return {
    instructions,
    text: instructions.map((instruction) => instruction.text),
    registers: [...registers],
    labels: [...new Set(labels)],
  };
}
