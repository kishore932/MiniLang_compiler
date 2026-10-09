import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/compiler/lexer.js';

test('tokenizes a simple declaration with exact token locations', () => {
  const { tokens, errors } = tokenize('let x = 10;');

  assert.deepEqual(errors, []);
  assert.deepEqual(tokens.map(({ type, value, line, column }) => ({ type, value, line, column })), [
    { type: 'KEYWORD_LET', value: 'let', line: 1, column: 1 },
    { type: 'IDENTIFIER', value: 'x', line: 1, column: 5 },
    { type: 'ASSIGN', value: '=', line: 1, column: 7 },
    { type: 'NUMBER', value: '10', line: 1, column: 9 },
    { type: 'SEMICOLON', value: ';', line: 1, column: 11 },
  ]);
  assert.equal(tokens[3].numericType, 'int');
});

test('preserves floating-point lexemes and numeric type', () => {
  const { tokens, errors } = tokenize('let price = 25.50;');
  const number = tokens.find((token) => token.type === 'NUMBER');

  assert.deepEqual(errors, []);
  assert.equal(number.value, '25.50');
  assert.equal(number.numericType, 'float');
});

test('tokenizes multiple arithmetic operators', () => {
  const { tokens, errors } = tokenize('let result = a + b * 2;');

  assert.deepEqual(errors, []);
  assert.deepEqual(tokens.filter((token) => ['PLUS', 'MULTIPLY'].includes(token.type)).map((token) => token.type), [
    'PLUS', 'MULTIPLY',
  ]);
});

test('tokenizes parentheses', () => {
  const { tokens, errors } = tokenize('let result = (a + b) * 2;');

  assert.deepEqual(errors, []);
  assert.deepEqual(tokens.filter((token) => ['LPAREN', 'RPAREN'].includes(token.type)).map((token) => token.type), [
    'LPAREN', 'RPAREN',
  ]);
});

test('tokenizes print statements', () => {
  const { tokens, errors } = tokenize('print result;');

  assert.deepEqual(errors, []);
  assert.equal(tokens[0].type, 'KEYWORD_PRINT');
});

test('tokenizes if blocks and comparison expressions', () => {
  const { tokens, errors } = tokenize('if (x > 10) {\n    print x;\n}');

  assert.deepEqual(errors, []);
  assert.deepEqual(tokens.filter((token) => ['KEYWORD_IF', 'LPAREN', 'GREATER_THAN', 'RPAREN', 'LBRACE', 'KEYWORD_PRINT', 'RBRACE'].includes(token.type)).map((token) => token.type), [
    'KEYWORD_IF', 'LPAREN', 'GREATER_THAN', 'RPAREN', 'LBRACE', 'KEYWORD_PRINT', 'RBRACE',
  ]);
  assert.equal(tokens.find((token) => token.value === 'print').line, 2);
});

test('tokenizes while blocks and assignment', () => {
  const { tokens, errors } = tokenize('while (x < 20) {\n    x = x + 1;\n}');

  assert.deepEqual(errors, []);
  assert.equal(tokens[0].type, 'KEYWORD_WHILE');
  assert.ok(tokens.some((token) => token.type === 'LESS_THAN'));
  assert.equal(tokens.filter((token) => token.type === 'ASSIGN').length, 1);
});

test('ignores single-line comments', () => {
  const { tokens, errors } = tokenize('let x = 10; // test comment\nprint x;');

  assert.deepEqual(errors, []);
  assert.equal(tokens.some((token) => token.value === 'test' || token.value === 'comment'), false);
  assert.equal(tokens.at(-2).type, 'IDENTIFIER');
  assert.equal(tokens.at(-2).line, 2);
});

test('recognizes each comparison operator with a distinct type', () => {
  const { tokens, errors } = tokenize('> < >= <= == !=');

  assert.deepEqual(errors, []);
  assert.deepEqual(tokens.map((token) => token.type), [
    'GREATER_THAN', 'LESS_THAN', 'GREATER_EQUAL', 'LESS_EQUAL', 'EQUAL_EQUAL', 'NOT_EQUAL',
  ]);
});

test('reports an invalid character with phase, line, and column', () => {
  const { tokens, errors } = tokenize('let x = 10 @ 20;');

  assert.equal(tokens.some((token) => token.value === '@'), false);
  assert.deepEqual(errors, [{
    phase: 'lexical',
    type: 'LEXICAL_ERROR',
    message: "Unexpected character '@'",
    line: 1,
    column: 12,
  }]);
});

test('reports a malformed multi-dot number as one lexical error', () => {
  const { tokens, errors } = tokenize('let x = 10.5.7;');

  assert.equal(tokens.some((token) => token.type === 'NUMBER'), false);
  assert.deepEqual(errors, [{
    phase: 'lexical',
    type: 'LEXICAL_ERROR',
    message: "Malformed number '10.5.7'",
    line: 1,
    column: 9,
  }]);
});

test('tracks columns after tabs and resets columns on LF and CRLF newlines', () => {
  const { tokens, errors } = tokenize('let\tx = 1;\r\nprint x;');
  const printToken = tokens.find((token) => token.type === 'KEYWORD_PRINT');

  assert.deepEqual(errors, []);
  assert.deepEqual(
    tokens.slice(0, 3).map(({ value, line, column }) => ({ value, line, column })),
    [
      { value: 'let', line: 1, column: 1 },
      { value: 'x', line: 1, column: 5 },
      { value: '=', line: 1, column: 7 },
    ],
  );
  assert.deepEqual({ line: printToken.line, column: printToken.column }, { line: 2, column: 1 });
});

test('recognizes identifiers with letters, digits, and underscores', () => {
  const { tokens, errors } = tokenize('a total number1 my_value x2 _hidden');

  assert.deepEqual(errors, []);
  assert.deepEqual(tokens.map((token) => token.type), Array(6).fill('IDENTIFIER'));
});

test('does not classify a digit-leading name as an identifier', () => {
  const { tokens, errors } = tokenize('1name');

  assert.deepEqual(errors, []);
  assert.deepEqual(tokens.map((token) => [token.type, token.value]), [
    ['NUMBER', '1'],
    ['IDENTIFIER', 'name'],
  ]);
});

test('reports a trailing decimal point as a malformed number', () => {
  const { tokens, errors } = tokenize('let x = 10.;');

  assert.equal(tokens.some((token) => token.type === 'NUMBER'), false);
  assert.match(errors[0].message, /Malformed number '10\.'/);
});

test('recognizes every keyword, arithmetic operator, assignment, and delimiter', () => {
  const { tokens, errors } = tokenize('let print if else while + - * / = ( ) { } ;');

  assert.deepEqual(errors, []);
  assert.deepEqual(tokens.map((token) => token.type), [
    'KEYWORD_LET', 'KEYWORD_PRINT', 'KEYWORD_IF', 'KEYWORD_ELSE', 'KEYWORD_WHILE',
    'PLUS', 'MINUS', 'MULTIPLY', 'DIVIDE', 'ASSIGN', 'LPAREN', 'RPAREN', 'LBRACE', 'RBRACE', 'SEMICOLON',
  ]);
});