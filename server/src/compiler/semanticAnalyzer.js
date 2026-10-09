import { SymbolTable } from './symbolTable.js';

const COMPARISON_OPERATORS = new Set(['>', '<', '>=', '<=', '==', '!=']);
const NUMERIC_TYPES = new Set(['int', 'float']);

class SemanticAnalyzer {
  constructor() {
    this.symbols = new SymbolTable();
    this.semanticErrors = [];
    this.warnings = [];
  }

  analyze(ast) {
    this.visitProgram(ast);
    return {
      symbolTable: this.symbols.toJSON(),
      semanticErrors: this.semanticErrors,
      warnings: this.warnings,
    };
  }

  visitProgram(program) {
    for (const statement of program.body) this.visitStatement(statement);
  }

  visitStatement(statement) {
    switch (statement.type) {
      case 'VariableDeclaration': return this.visitVariableDeclaration(statement);
      case 'Assignment': return this.visitAssignment(statement);
      case 'PrintStatement': return this.visitPrintStatement(statement);
      case 'IfStatement': return this.visitIfStatement(statement);
      case 'WhileStatement': return this.visitWhileStatement(statement);
      case 'BlockStatement': return this.visitBlock(statement);
      default:
        this.addError(`Unsupported statement '${statement.type}'`, statement.line, statement.column);
        return null;
    }
  }

  visitVariableDeclaration(node) {
    const initializerType = this.visitExpression(node.initializer);
    const declarationLine = node.nameLine ?? node.line;
    const declarationColumn = node.nameColumn ?? node.column;

    if (this.symbols.hasInCurrentScope(node.name)) {
      this.addError(
        `Variable '${node.name}' has already been declared in this scope.`,
        declarationLine,
        declarationColumn,
      );
      node.inferredType = initializerType;
      return initializerType;
    }

    const type = NUMERIC_TYPES.has(initializerType) ? initializerType : 'unknown';
    const symbol = {
      name: node.name,
      type,
      initialized: true,
      declarationLine,
      declarationColumn,
      scope: this.symbols.currentScope.name,
    };
    this.symbols.declare(symbol);
    node.inferredType = type;
    return type;
  }

  visitAssignment(node) {
    const symbol = this.symbols.resolve(node.name);
    const valueType = this.visitExpression(node.value);

    if (!symbol) {
      this.addError(
        `Variable '${node.name}' has not been declared.`,
        node.nameLine ?? node.line,
        node.nameColumn ?? node.column,
      );
      return valueType;
    }

    symbol.initialized = true;
    node.inferredType = symbol.type;
    return symbol.type;
  }

  visitPrintStatement(node) {
    return this.visitExpression(node.argument);
  }

  visitIfStatement(node) {
    this.visitCondition(node.condition);
    this.visitBlock(node.consequent);
    if (node.alternate) this.visitBlock(node.alternate);
    return null;
  }

  visitWhileStatement(node) {
    this.visitCondition(node.condition);
    this.visitBlock(node.body);
    return null;
  }

  visitBlock(node) {
    this.symbols.enterBlock();

    for (const statement of node.body) this.visitStatement(statement);

    this.symbols.exitBlock();
    return null;
  }

  visitCondition(node) {
    const leftType = this.visitExpression(node.left);
    const rightType = this.visitExpression(node.right);

    if (leftType !== 'unknown' && !NUMERIC_TYPES.has(leftType)) {
      this.addError('Condition left operand must be a numeric expression.', node.left.line, node.left.column);
    }
    if (rightType !== 'unknown' && !NUMERIC_TYPES.has(rightType)) {
      this.addError('Condition right operand must be a numeric expression.', node.right.line, node.right.column);
    }

    node.inferredType = 'bool';
    return 'bool';
  }

  visitExpression(node) {
    switch (node.type) {
      case 'NumberLiteral':
        node.inferredType = node.numericType;
        return node.numericType;
      case 'Identifier':
        return this.visitIdentifier(node);
      case 'GroupedExpression':
        node.inferredType = this.visitExpression(node.expression);
        return node.inferredType;
      case 'UnaryExpression':
        return this.visitUnaryExpression(node);
      case 'BinaryExpression':
        return this.visitBinaryExpression(node);
      default:
        this.addError(`Unsupported expression '${node.type}'`, node.line, node.column);
        node.inferredType = 'unknown';
        return 'unknown';
    }
  }

  visitIdentifier(node) {
    const symbol = this.symbols.resolve(node.name);
    if (!symbol) {
      this.addError(`Variable '${node.name}' has not been declared.`, node.line, node.column);
      node.inferredType = 'unknown';
      return 'unknown';
    }

    node.inferredType = symbol.type;
    return symbol.type;
  }

  visitUnaryExpression(node) {
    const argumentType = this.visitExpression(node.argument);
    if (argumentType !== 'unknown' && !NUMERIC_TYPES.has(argumentType)) {
      this.addError('Unary minus requires a numeric expression.', node.line, node.column);
      node.inferredType = 'unknown';
      return 'unknown';
    }

    node.inferredType = argumentType;
    return argumentType;
  }

  visitBinaryExpression(node) {
    const leftType = this.visitExpression(node.left);
    const rightType = this.visitExpression(node.right);

    if (COMPARISON_OPERATORS.has(node.operator)) {
      if (leftType !== 'unknown' && !NUMERIC_TYPES.has(leftType)) {
        this.addError('Comparison left operand must be a numeric expression.', node.left.line, node.left.column);
      }
      if (rightType !== 'unknown' && !NUMERIC_TYPES.has(rightType)) {
        this.addError('Comparison right operand must be a numeric expression.', node.right.line, node.right.column);
      }
      node.inferredType = 'bool';
      return 'bool';
    }

    if (leftType === 'unknown' || rightType === 'unknown') {
      node.inferredType = 'unknown';
      return 'unknown';
    }

    if (!NUMERIC_TYPES.has(leftType) || !NUMERIC_TYPES.has(rightType)) {
      this.addError('Arithmetic operands must be numeric expressions.', node.line, node.column);
      node.inferredType = 'unknown';
      return 'unknown';
    }

    node.inferredType = leftType === 'float' || rightType === 'float' ? 'float' : 'int';
    return node.inferredType;
  }

  addError(message, line, column) {
    this.semanticErrors.push({
      phase: 'semantic',
      type: 'SEMANTIC_ERROR',
      message,
      line,
      column,
    });
  }
}

export function analyzeSemantics(ast) {
  if (!ast || typeof ast !== 'object' || ast.type !== 'Program') {
    throw new TypeError('Semantic analyzer input must be a Program AST');
  }

  return new SemanticAnalyzer().analyze(ast);
}