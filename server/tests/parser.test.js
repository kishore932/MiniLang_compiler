import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/compiler/lexer.js';
import { parse } from '../src/compiler/parser.js';

function parseSource(source) {
  const lexical = tokenize(source);
  assert.deepEqual(lexical.errors, []);
  return parse(lexical.tokens);
}

test('parses variable declarations and preserves literal data', () => {
  const { ast, syntaxTree, errors } = parseSource('let a = 10;');
  const declaration = ast.body[0];

  assert.deepEqual(errors, []);
  assert.equal(declaration.type, 'VariableDeclaration');
  assert.equal(declaration.name, 'a');
  assert.deepEqual(declaration.initializer, {
    type: 'NumberLiteral', line: 1, column: 9, value: '10', numericType: 'int',
  });
  assert.equal(syntaxTree.type, 'Program');
  assert.equal(syntaxTree.children[0].type, 'Statement');
  assert.equal(syntaxTree.children[0].children[0].type, 'VariableDeclaration');
});

test('parses assignments and print statements', () => {
  const { ast, errors } = parseSource('x = 4;\nprint x;');

  assert.deepEqual(errors, []);
  assert.equal(ast.body[0].type, 'Assignment');
  assert.equal(ast.body[0].name, 'x');
  assert.equal(ast.body[1].type, 'PrintStatement');
  assert.deepEqual(ast.body[1].argument, {
    type: 'Identifier', line: 2, column: 7, name: 'x',
  });
});

test('parses arithmetic and applies multiplication precedence', () => {
  const { ast, errors } = parseSource('let result = 10 + 20 * 2;');
  const expression = ast.body[0].initializer;

  assert.deepEqual(errors, []);
  assert.equal(expression.type, 'BinaryExpression');
  assert.equal(expression.operator, '+');
  assert.equal(expression.right.operator, '*');
});

test('parentheses override arithmetic precedence', () => {
  const { ast, errors } = parseSource('let result = (10 + 20) * 2;');
  const expression = ast.body[0].initializer;

  assert.deepEqual(errors, []);
  assert.equal(expression.operator, '*');
  assert.equal(expression.left.type, 'GroupedExpression');
  assert.equal(expression.left.expression.operator, '+');
});

test('parses unary minus', () => {
  const { ast, errors } = parseSource('let result = -10 + 5;');
  const expression = ast.body[0].initializer;

  assert.deepEqual(errors, []);
  assert.equal(expression.operator, '+');
  assert.equal(expression.left.type, 'UnaryExpression');
  assert.equal(expression.left.operator, '-');
  assert.equal(expression.left.argument.value, '10');
});

test('parses if and if-else blocks', () => {
  const { ast, errors } = parseSource(
    'let x = 15;\nif (x > 10) {\n print x;\n} else {\n print 0;\n}',
  );
  const conditional = ast.body[1];

  assert.deepEqual(errors, []);
  assert.equal(conditional.type, 'IfStatement');
  assert.equal(conditional.condition.operator, '>');
  assert.equal(conditional.consequent.type, 'BlockStatement');
  assert.equal(conditional.consequent.body[0].type, 'PrintStatement');
  assert.equal(conditional.alternate.body[0].argument.value, '0');
});

test('parses while and nested control-flow blocks', () => {
  const { ast, errors } = parseSource(
    'let x = 0;\nwhile (x < 10) {\n if (x != 4) {\n  x = x + 1;\n }\n}',
  );
  const loop = ast.body[1];

  assert.deepEqual(errors, []);
  assert.equal(loop.type, 'WhileStatement');
  assert.equal(loop.condition.operator, '<');
  assert.equal(loop.body.body[0].type, 'IfStatement');
  assert.equal(loop.body.body[0].consequent.body[0].type, 'Assignment');
});

test('parses all comparison operators in expressions', () => {
  for (const operator of ['>', '<', '>=', '<=', '==', '!=']) {
    const { ast, errors } = parseSource(`let check = a ${operator} b;`);
    assert.deepEqual(errors, [], `expected ${operator} expression to parse`);
    assert.equal(ast.body[0].initializer.operator, operator);
  }
});

test('reports a missing semicolon at the end of the declaration', () => {
  const { ast, errors } = parseSource('let x = 10');

  assert.equal(ast.body.length, 0);
  assert.equal(errors[0].message, 'Expected semicolon after variable declaration');
  assert.deepEqual({ line: errors[0].line, column: errors[0].column }, { line: 1, column: 11 });
});

test('reports a missing initializer expression at the semicolon', () => {
  const { errors } = parseSource('let x = ;');

  assert.equal(errors[0].message, "Expected expression after '='");
  assert.deepEqual({ line: errors[0].line, column: errors[0].column }, { line: 1, column: 9 });
});

test('reports a missing declaration identifier', () => {
  const { errors } = parseSource('let = 10;');

  assert.equal(errors[0].message, "Expected identifier after 'let'");
  assert.deepEqual({ line: errors[0].line, column: errors[0].column }, { line: 1, column: 5 });
});

test('reports a missing closing parenthesis', () => {
  const { errors } = parseSource('if (x > 10 {\n print x;\n}');

  assert.equal(errors[0].message, "Expected ')' after if condition");
  assert.deepEqual({ line: errors[0].line, column: errors[0].column }, { line: 1, column: 12 });
});

test('requires braces around if bodies', () => {
  const { errors } = parseSource('if (x > 10)\n print x;');

  assert.equal(errors[0].message, "Expected '{' to begin if block");
  assert.deepEqual({ line: errors[0].line, column: errors[0].column }, { line: 2, column: 2 });
});

test('reports a missing closing brace', () => {
  const { errors } = parseSource('if (x > 10) {\n print x;');

  assert.equal(errors.at(-1).message, "Expected '}' to close if block");
  assert.equal(errors.at(-1).line, 2);
});

test('reports invalid statements and unexpected operators', () => {
  const invalidStatement = parseSource('hello something;');
  const invalidExpression = parseSource('let x = 10 + * 20;');

  assert.equal(invalidStatement.errors[0].phase, 'syntax');
  assert.equal(invalidStatement.errors[0].type, 'SYNTAX_ERROR');
  assert.equal(invalidExpression.errors[0].message, "Expected expression after '+'");
  assert.deepEqual(
    { line: invalidExpression.errors[0].line, column: invalidExpression.errors[0].column },
    { line: 1, column: 14 },
  );
});

test('recovers after a malformed statement and parses the following declaration', () => {
  const { ast, errors } = parseSource('let a = 10;\nlet b = ;\nlet c = 20;');

  assert.equal(errors.length, 1);
  assert.deepEqual(ast.body.map((statement) => statement.name), ['a', 'c']);
});

test('reports syntax errors with syntax phase and source location', () => {
  const { errors } = parseSource('\nlet x = ;');

  assert.deepEqual(errors[0], {
    phase: 'syntax',
    type: 'SYNTAX_ERROR',
    message: "Expected expression after '='",
    line: 2,
    column: 9,
  });
});