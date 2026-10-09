class GenerationFailure extends Error {
  constructor(node, message) {
    super(message);
    this.diagnostic = {
      phase: 'intermediate',
      type: 'TAC_GENERATION_ERROR',
      message,
      line: node?.line ?? 1,
      column: node?.column ?? 1,
    };
  }
}

class TacGenerator {
  constructor() {
    this.instructions = [];
    this.temporaries = 0;
    this.labels = 0;
    this.errors = [];
  }

  generate(program) {
    try {
      this.visitStatements(program.body);
    } catch (error) {
      if (!(error instanceof GenerationFailure)) throw error;
      this.errors.push(error.diagnostic);
    }

    return {
      instructions: this.instructions,
      temporaries: this.temporaries,
      labels: this.labels,
      formattedCode: formatTacCode(this.instructions),
      errors: this.errors,
    };
  }

  visitStatements(statements) {
    for (const statement of statements) this.visitStatement(statement);
  }

  visitStatement(node) {
    switch (node.type) {
      case 'VariableDeclaration':
        this.emit('=', this.visitExpression(node.initializer), null, node.name);
        return;
      case 'Assignment':
        this.emit('=', this.visitExpression(node.value), null, node.name);
        return;
      case 'PrintStatement':
        this.emit('PRINT', this.visitExpression(node.argument), null, null);
        return;
      case 'BlockStatement':
        this.visitStatements(node.body);
        return;
      case 'IfStatement':
        this.visitIfStatement(node);
        return;
      case 'WhileStatement':
        this.visitWhileStatement(node);
        return;
      default:
        throw new GenerationFailure(node, `Unsupported statement '${node.type}' in TAC generation`);
    }
  }

  visitIfStatement(node) {
    const condition = this.visitExpression(node.condition);
    const alternateLabel = this.newLabel();

    this.emit('IF_FALSE', condition, alternateLabel, null);
    this.visitStatement(node.consequent);

    if (!node.alternate) {
      this.emit('LABEL', alternateLabel, null, null);
      return;
    }

    const endLabel = this.newLabel();
    this.emit('GOTO', endLabel, null, null);
    this.emit('LABEL', alternateLabel, null, null);
    this.visitStatement(node.alternate);
    this.emit('LABEL', endLabel, null, null);
  }

  visitWhileStatement(node) {
    const loopLabel = this.newLabel();
    const exitLabel = this.newLabel();

    this.emit('LABEL', loopLabel, null, null);
    const condition = this.visitExpression(node.condition);
    this.emit('IF_FALSE', condition, exitLabel, null);
    this.visitStatement(node.body);
    this.emit('GOTO', loopLabel, null, null);
    this.emit('LABEL', exitLabel, null, null);
  }

  visitExpression(node) {
    switch (node.type) {
      case 'NumberLiteral':
        return node.value;
      case 'Identifier':
        return node.name;
      case 'GroupedExpression':
        return this.visitExpression(node.expression);
      case 'UnaryExpression': {
        const operand = this.visitExpression(node.argument);
        const result = this.newTemporary();
        this.emit('NEGATE', operand, null, result);
        return result;
      }
      case 'BinaryExpression': {
        const left = this.visitExpression(node.left);
        const right = this.visitExpression(node.right);
        const result = this.newTemporary();
        this.emit(node.operator, left, right, result);
        return result;
      }
      default:
        throw new GenerationFailure(node, `Unsupported expression '${node.type}' in TAC generation`);
    }
  }

  newTemporary() {
    this.temporaries += 1;
    return `t${this.temporaries}`;
  }

  newLabel() {
    this.labels += 1;
    return `L${this.labels}`;
  }

  emit(op, arg1 = null, arg2 = null, result = null) {
    this.instructions.push({
      index: this.instructions.length + 1,
      op,
      arg1,
      arg2,
      result,
    });
  }
}

export function generateThreeAddressCode(ast) {
  if (!ast || typeof ast !== 'object' || ast.type !== 'Program' || !Array.isArray(ast.body)) {
    throw new TypeError('TAC generator input must be a validated Program AST');
  }

  return new TacGenerator().generate(ast);
}

export function formatTacInstruction(instruction) {
  const { op, arg1, arg2, result } = instruction;

  if (op === '=') return `${result} = ${arg1}`;
  if (op === 'NEGATE') return `${result} = -${arg1}`;
  if (op === 'PRINT') return `PRINT ${arg1}`;
  if (op === 'LABEL') return `${arg1}:`;
  if (op === 'GOTO') return `GOTO ${arg1}`;
  if (op === 'IF_FALSE') return `IF_FALSE ${arg1} GOTO ${arg2}`;
  return `${result} = ${arg1} ${op} ${arg2}`;
}

export function formatTacCode(instructions) {
  return instructions.map(formatTacInstruction).join('\n');
}