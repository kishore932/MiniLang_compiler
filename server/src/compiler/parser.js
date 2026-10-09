const COMPARISON_TYPES = new Set([
  'GREATER_THAN',
  'LESS_THAN',
  'GREATER_EQUAL',
  'LESS_EQUAL',
  'EQUAL_EQUAL',
  'NOT_EQUAL',
]);

const STATEMENT_KEYWORDS = new Set([
  'KEYWORD_LET',
  'KEYWORD_PRINT',
  'KEYWORD_IF',
  'KEYWORD_WHILE',
]);

const TOKEN_TYPE_TO_SYNTAX_TEXT = {
  KEYWORD_LET: 'Keyword',
  KEYWORD_PRINT: 'Keyword',
  KEYWORD_IF: 'Keyword',
  KEYWORD_ELSE: 'Keyword',
  KEYWORD_WHILE: 'Keyword',
  IDENTIFIER: 'Identifier',
  ASSIGN: 'AssignmentOperator',
  NUMBER: 'Number',
  SEMICOLON: 'Semicolon',
  LPAREN: 'LeftParen',
  RPAREN: 'RightParen',
  LBRACE: 'LeftBrace',
  RBRACE: 'RightBrace',
  PLUS: 'Operator',
  MINUS: 'Operator',
  MULTIPLY: 'Operator',
  DIVIDE: 'Operator',
  GREATER_THAN: 'ComparisonOperator',
  LESS_THAN: 'ComparisonOperator',
  GREATER_EQUAL: 'ComparisonOperator',
  LESS_EQUAL: 'ComparisonOperator',
  EQUAL_EQUAL: 'ComparisonOperator',
  NOT_EQUAL: 'ComparisonOperator',
};

class ParseFailure extends Error {
  constructor(diagnostic) {
    super(diagnostic.message);
    this.diagnostic = diagnostic;
  }
}

function toSyntaxNode(token, valueOverride = token.value) {
  const type = TOKEN_TYPE_TO_SYNTAX_TEXT[token.type] ?? token.type;
  return {
    type,
    value: valueOverride,
    line: token.line,
    column: token.column,
  };
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.current = 0;
    this.errors = [];
  }

  buildStatementSyntaxNode(statementNode) {
    return {
      type: 'Statement',
      line: statementNode.line,
      column: statementNode.column,
      children: [statementNode],
    };
  }

  parseProgram() {
    const firstToken = this.peek();
    const statements = [];
    const syntaxChildren = [];

    while (!this.isAtEnd()) {
      const statementStart = this.current;
      try {
        const parsedStatement = this.parseStatement();
        statements.push(parsedStatement.ast);
        syntaxChildren.push(this.buildStatementSyntaxNode(parsedStatement.syntaxTree));
      } catch (error) {
        if (!(error instanceof ParseFailure)) throw error;
        this.errors.push(error.diagnostic);
        this.synchronize(statementStart);
      }
    }

    return {
      ast: {
        type: 'Program',
        line: firstToken?.line ?? 1,
        column: firstToken?.column ?? 1,
        body: statements,
      },
      syntaxTree: {
        type: 'Program',
        line: firstToken?.line ?? 1,
        column: firstToken?.column ?? 1,
        children: syntaxChildren,
      },
      errors: this.errors,
    };
  }

  parseStatement() {
    switch (this.peek()?.type) {
      case 'KEYWORD_LET': return this.parseVariableDeclaration();
      case 'IDENTIFIER': return this.parseAssignment();
      case 'KEYWORD_PRINT': return this.parsePrintStatement();
      case 'KEYWORD_IF': return this.parseIfStatement();
      case 'KEYWORD_WHILE': return this.parseWhileStatement();
      default: this.fail('Expected a statement');
    }
  }

  parseVariableDeclaration() {
    const keyword = this.advance();
    const name = this.consume('IDENTIFIER', "Expected identifier after 'let'");
    const assign = this.consume('ASSIGN', "Expected '=' after variable name");
    const initializer = this.parseExpression("Expected expression after '='");
    const semicolon = this.consume('SEMICOLON', 'Expected semicolon after variable declaration');

    return {
      ast: {
        type: 'VariableDeclaration',
        line: keyword.line,
        column: keyword.column,
        name: name.value,
        nameLine: name.line,
        nameColumn: name.column,
        initializer: initializer.ast,
      },
      syntaxTree: {
        type: 'VariableDeclaration',
        line: keyword.line,
        column: keyword.column,
        children: [
          toSyntaxNode(keyword),
          toSyntaxNode(name),
          toSyntaxNode(assign),
          initializer.syntaxTree,
          toSyntaxNode(semicolon),
        ],
      },
    };
  }

  parseAssignment() {
    const name = this.advance();
    const assign = this.consume('ASSIGN', "Expected '=' after assignment target");
    const value = this.parseExpression("Expected expression after '='");
    const semicolon = this.consume('SEMICOLON', 'Expected semicolon after assignment');

    return {
      ast: {
        type: 'Assignment',
        line: name.line,
        column: name.column,
        name: name.value,
        nameLine: name.line,
        nameColumn: name.column,
        value: value.ast,
      },
      syntaxTree: {
        type: 'Assignment',
        line: name.line,
        column: name.column,
        children: [
          toSyntaxNode(name),
          toSyntaxNode(assign),
          value.syntaxTree,
          toSyntaxNode(semicolon),
        ],
      },
    };
  }

  parsePrintStatement() {
    const keyword = this.advance();
    const argument = this.parseExpression("Expected expression after 'print'");
    const semicolon = this.consume('SEMICOLON', 'Expected semicolon after print statement');

    return {
      ast: {
        type: 'PrintStatement',
        line: keyword.line,
        column: keyword.column,
        argument: argument.ast,
      },
      syntaxTree: {
        type: 'PrintStatement',
        line: keyword.line,
        column: keyword.column,
        children: [
          toSyntaxNode(keyword),
          argument.syntaxTree,
          toSyntaxNode(semicolon),
        ],
      },
    };
  }

  parseIfStatement() {
    const keyword = this.advance();
    this.consume('LPAREN', "Expected '(' after 'if'");
    const condition = this.parseCondition();
    this.consume('RPAREN', "Expected ')' after if condition");
    const consequent = this.parseBlock('if');
    let elseKeyword = null;
    let alternate = null;

    if (this.match('KEYWORD_ELSE')) {
      elseKeyword = this.previous();
      alternate = this.parseBlock('else');
    }

    return {
      ast: {
        type: 'IfStatement',
        line: keyword.line,
        column: keyword.column,
        condition: condition.ast,
        consequent: consequent.ast,
        alternate: alternate ? alternate.ast : null,
      },
      syntaxTree: {
        type: 'IfStatement',
        line: keyword.line,
        column: keyword.column,
        children: [
          toSyntaxNode(keyword),
          condition.syntaxTree,
          consequent.syntaxTree,
          ...(elseKeyword ? [toSyntaxNode(elseKeyword), alternate.syntaxTree] : []),
        ],
      },
    };
  }

  parseWhileStatement() {
    const keyword = this.advance();
    this.consume('LPAREN', "Expected '(' after 'while'");
    const condition = this.parseCondition();
    this.consume('RPAREN', "Expected ')' after while condition");
    const body = this.parseBlock('while');

    return {
      ast: {
        type: 'WhileStatement',
        line: keyword.line,
        column: keyword.column,
        condition: condition.ast,
        body: body.ast,
      },
      syntaxTree: {
        type: 'WhileStatement',
        line: keyword.line,
        column: keyword.column,
        children: [
          toSyntaxNode(keyword),
          condition.syntaxTree,
          body.syntaxTree,
        ],
      },
    };
  }

  parseBlock(owner) {
    const openingBrace = this.consume('LBRACE', `Expected '{' to begin ${owner} block`);
    const body = [];
    const syntaxBody = [];

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      const statementStart = this.current;
      try {
        const parsedStatement = this.parseStatement();
        body.push(parsedStatement.ast);
        syntaxBody.push(this.buildStatementSyntaxNode(parsedStatement.syntaxTree));
      } catch (error) {
        if (!(error instanceof ParseFailure)) throw error;
        this.errors.push(error.diagnostic);
        this.synchronize(statementStart);
      }
    }

    const closingBrace = this.consume('RBRACE', `Expected '}' to close ${owner} block`);

    return {
      ast: {
        type: 'BlockStatement',
        line: openingBrace.line,
        column: openingBrace.column,
        body,
      },
      syntaxTree: {
        type: 'BlockStatement',
        line: openingBrace.line,
        column: openingBrace.column,
        children: [
          toSyntaxNode(openingBrace),
          ...syntaxBody,
          toSyntaxNode(closingBrace),
        ],
      },
    };
  }

  parseCondition() {
    const left = this.parseAddition('Expected left expression in condition');
    const operator = this.peek();
    if (!COMPARISON_TYPES.has(operator?.type)) {
      this.fail('Expected comparison operator in condition');
    }

    this.advance();
    const right = this.parseAddition('Expected right expression after comparison operator');
    return {
      ast: this.binaryExpression(operator, left.ast, right.ast),
      syntaxTree: {
        type: 'Condition',
        line: operator.line,
        column: operator.column,
        children: [
          left.syntaxTree,
          toSyntaxNode(operator, operator.value),
          right.syntaxTree,
        ],
      },
    };
  }

  parseExpression(expectedMessage = 'Expected expression') {
    return this.parseComparison(expectedMessage);
  }

  parseComparison(expectedMessage) {
    const left = this.parseAddition(expectedMessage);
    if (!COMPARISON_TYPES.has(this.peek()?.type)) return left;

    const operator = this.advance();
    const right = this.parseAddition('Expected expression after comparison operator');
    return {
      ast: this.binaryExpression(operator, left.ast, right.ast),
      syntaxTree: {
        type: 'ComparisonExpression',
        line: operator.line,
        column: operator.column,
        children: [
          left.syntaxTree,
          toSyntaxNode(operator, operator.value),
          right.syntaxTree,
        ],
      },
    };
  }

  parseAddition(expectedMessage) {
    let result = this.parseMultiplication(expectedMessage);

    while (this.match('PLUS', 'MINUS')) {
      const operator = this.previous();
      const right = this.parseMultiplication(`Expected expression after '${operator.value}'`);
      result = {
        ast: this.binaryExpression(operator, result.ast, right.ast),
        syntaxTree: {
          type: operator.type === 'PLUS' ? 'Addition' : 'Subtraction',
          line: operator.line,
          column: operator.column,
          children: [
            result.syntaxTree,
            toSyntaxNode(operator, operator.value),
            right.syntaxTree,
          ],
        },
      };
    }

    return result;
  }

  parseMultiplication(expectedMessage) {
    let result = this.parseUnary(expectedMessage);

    while (this.match('MULTIPLY', 'DIVIDE')) {
      const operator = this.previous();
      const right = this.parseUnary(`Expected expression after '${operator.value}'`);
      result = {
        ast: this.binaryExpression(operator, result.ast, right.ast),
        syntaxTree: {
          type: operator.type === 'MULTIPLY' ? 'Multiplication' : 'Division',
          line: operator.line,
          column: operator.column,
          children: [
            result.syntaxTree,
            toSyntaxNode(operator, operator.value),
            right.syntaxTree,
          ],
        },
      };
    }

    return result;
  }

  parseUnary(expectedMessage) {
    if (this.match('MINUS')) {
      const operator = this.previous();
      const argument = this.parseUnary("Expected expression after unary '-' ");
      return {
        ast: {
          type: 'UnaryExpression',
          line: operator.line,
          column: operator.column,
          operator: operator.value,
          operatorType: operator.type,
          argument: argument.ast,
        },
        syntaxTree: {
          type: 'UnaryExpression',
          line: operator.line,
          column: operator.column,
          children: [
            toSyntaxNode(operator),
            argument.syntaxTree,
          ],
        },
      };
    }

    return this.parsePrimary(expectedMessage);
  }

  parsePrimary(expectedMessage) {
    if (this.match('NUMBER')) {
      const token = this.previous();
      return {
        ast: {
          type: 'NumberLiteral',
          line: token.line,
          column: token.column,
          value: token.value,
          numericType: token.numericType,
        },
        syntaxTree: toSyntaxNode(token),
      };
    }

    if (this.match('IDENTIFIER')) {
      const token = this.previous();
      return {
        ast: {
          type: 'Identifier',
          line: token.line,
          column: token.column,
          name: token.value,
        },
        syntaxTree: toSyntaxNode(token),
      };
    }

    if (this.match('LPAREN')) {
      const openingParen = this.previous();
      const expression = this.parseExpression(expectedMessage);
      const closingParen = this.consume('RPAREN', "Expected ')' after expression");
      return {
        ast: {
          type: 'GroupedExpression',
          line: openingParen.line,
          column: openingParen.column,
          expression: expression.ast,
        },
        syntaxTree: {
          type: 'GroupedExpression',
          line: openingParen.line,
          column: openingParen.column,
          children: [
            toSyntaxNode(openingParen),
            expression.syntaxTree,
            toSyntaxNode(closingParen),
          ],
        },
      };
    }

    this.fail(expectedMessage);
  }

  binaryExpression(operator, left, right) {
    return {
      type: 'BinaryExpression',
      line: operator.line,
      column: operator.column,
      operator: operator.value,
      operatorType: operator.type,
      left,
      right,
    };
  }

  consume(type, message) {
    if (this.check(type)) return this.advance();
    this.fail(message);
  }

  match(...types) {
    if (!types.some((type) => this.check(type))) return false;
    this.advance();
    return true;
  }

  check(type) {
    return !this.isAtEnd() && this.peek().type === type;
  }

  advance() {
    if (!this.isAtEnd()) this.current += 1;
    return this.previous();
  }

  isAtEnd() {
    return this.current >= this.tokens.length;
  }

  peek() {
    return this.tokens[this.current];
  }

  previous() {
    return this.tokens[this.current - 1];
  }

  fail(message) {
    const token = this.peek();
    const previous = this.previous();
    const line = token?.line ?? previous?.line ?? 1;
    const column = token?.column ?? (previous ? previous.column + previous.value.length : 1);
    throw new ParseFailure({
      phase: 'syntax',
      type: 'SYNTAX_ERROR',
      message,
      line,
      column,
    });
  }

  isStatementStart() {
    const token = this.peek();
    if (!token) return false;
    if (STATEMENT_KEYWORDS.has(token.type)) return true;
    return token.type === 'IDENTIFIER' && this.tokens[this.current + 1]?.type === 'ASSIGN';
  }

  // Resume at the next statement boundary, leaving its first token for normal parsing.
  synchronize(statementStart) {
    if (this.current === statementStart && !this.isAtEnd()) this.advance();

    while (!this.isAtEnd()) {
      if (this.previous()?.type === 'SEMICOLON' || this.check('RBRACE')) return;
      if (this.isStatementStart()) return;
      this.advance();
    }
  }
}

export function parse(tokens) {
  if (!Array.isArray(tokens)) {
    throw new TypeError('Parser input must be an array of lexer tokens');
  }

  return new Parser(tokens).parseProgram();
}
