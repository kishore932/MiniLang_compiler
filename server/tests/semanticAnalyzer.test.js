import test from 'node:test';
import assert from 'node:assert/strict';
import { compileSource } from '../src/compiler/compile.js';

const compile = (source) => compileSource(source);
const symbolOf = (result, name) => result.symbolTable.find((symbol) => symbol.name === name);

test('infers int from an integer initializer', () => {
  const result = compile('let a = 10;');

  assert.deepEqual(symbolOf(result, 'a'), {
    name: 'a', type: 'int', initialized: true,
    declarationLine: 1, declarationColumn: 5, scope: 'global',
  });
  assert.deepEqual(result.semanticErrors, []);
});

test('infers float from a floating-point initializer', () => {
  const result = compile('let a = 10.5;');

  assert.equal(symbolOf(result, 'a').type, 'float');
});

test('promotes mixed arithmetic to float and annotates expression types', () => {
  const result = compile('let a = 10;\nlet b = 20.5;\nlet c = a + b;');

  assert.equal(symbolOf(result, 'c').type, 'float');
  assert.equal(result.ast.body[2].initializer.inferredType, 'float');
});

test('reports undeclared variables used in expressions with source locations', () => {
  const result = compile('let a = 10;\nprint x;');

  assert.equal(result.semanticErrors.length, 1);
  assert.deepEqual(result.semanticErrors[0], {
    phase: 'semantic', type: 'SEMANTIC_ERROR',
    message: "Variable 'x' has not been declared.", line: 2, column: 7,
  });
});

test('reports duplicate declarations in the same scope', () => {
  const result = compile('let a = 10;\nlet a = 20;');

  assert.equal(result.semanticErrors.length, 1);
  assert.match(result.semanticErrors[0].message, /Variable 'a' has already been declared in this scope/);
  assert.deepEqual(
    { line: result.semanticErrors[0].line, column: result.semanticErrors[0].column },
    { line: 2, column: 5 },
  );
});

test('reports assignment to an undeclared variable', () => {
  const result = compile('a = 10;');

  assert.equal(result.semanticErrors[0].message, "Variable 'a' has not been declared.");
  assert.deepEqual(
    { line: result.semanticErrors[0].line, column: result.semanticErrors[0].column },
    { line: 1, column: 1 },
  );
});

test('does not expose declarations outside their block scope', () => {
  const result = compile(
    'let x = 10;\nif (x > 5) {\n let y = 20;\n print y;\n}\nprint y;',
  );

  assert.equal(result.semanticErrors.length, 1);
  assert.equal(result.semanticErrors[0].message, "Variable 'y' has not been declared.");
  assert.equal(result.semanticErrors[0].line, 6);
  assert.equal(symbolOf(result, 'y').scope, 'block-1');
});

test('allows nested blocks to resolve variables from outer scopes', () => {
  const result = compile('let x = 10;\nif (x > 5) {\n print x;\n}');

  assert.deepEqual(result.semanticErrors, []);
  assert.equal(result.ast.body[1].condition.left.inferredType, 'int');
});

test('preserves float type through grouped expressions', () => {
  const result = compile('let a = 10;\nlet b = 20.5;\nlet c = (a + b) * 2;');
  const expression = result.ast.body[2].initializer;

  assert.equal(symbolOf(result, 'c').type, 'float');
  assert.equal(expression.inferredType, 'float');
  assert.equal(expression.left.inferredType, 'float');
});

test('accepts assignments to declared variables', () => {
  const result = compile('let a = 10;\na = 20;');

  assert.deepEqual(result.semanticErrors, []);
  assert.equal(symbolOf(result, 'a').type, 'int');
  assert.equal(symbolOf(result, 'a').initialized, true);
});

test('uses separate scopes for sibling blocks', () => {
  const result = compile('if (1 < 2) { let local = 3; }\nif (2 < 3) { let local = 4; print local; }');

  assert.deepEqual(result.semanticErrors, []);
  assert.deepEqual(result.symbolTable.map((symbol) => symbol.scope), ['block-1', 'block-2']);
});

test('returns semantic result fields and measured compilation time', () => {
  const result = compile('let a = 1;');

  assert.ok(Array.isArray(result.tokens));
  assert.equal(result.ast.type, 'Program');
  assert.ok(Array.isArray(result.symbolTable));
  assert.ok(Array.isArray(result.semanticErrors));
  assert.ok(Array.isArray(result.warnings));
  assert.ok(Array.isArray(result.errors));
  assert.equal(result.semanticAnalysisPerformed, true);
  assert.ok(Number.isFinite(result.compilationTimeMs));
  assert.ok(result.compilationTimeMs >= 0);
});

test('skips semantic analysis after lexical or syntax errors', () => {
  const lexicalResult = compile('let a = @;');
  const syntaxResult = compile('let a = ;');

  assert.equal(lexicalResult.ast, null);
  assert.deepEqual(lexicalResult.symbolTable, []);
  assert.deepEqual(lexicalResult.semanticErrors, []);
  assert.equal(lexicalResult.semanticAnalysisPerformed, false);
  assert.equal(lexicalResult.errors[0].phase, 'lexical');
  assert.deepEqual(syntaxResult.symbolTable, []);
  assert.deepEqual(syntaxResult.semanticErrors, []);
  assert.equal(syntaxResult.semanticAnalysisPerformed, false);
  assert.equal(syntaxResult.errors[0].phase, 'syntax');
});

test('validates the complete requested control-flow and arithmetic program', () => {
  const source = `let a = 10;
let b = 20.5;
let c = a + b * 2;

if (c > 30) {
    print c;
} else {
    print 0;
}

while (a < 15) {
    a = a + 1;
}

print a;`;
  const result = compile(source);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.semanticErrors, []);
  assert.equal(result.semanticAnalysisPerformed, true);
  assert.equal(symbolOf(result, 'a').type, 'int');
  assert.equal(symbolOf(result, 'b').type, 'float');
  assert.equal(symbolOf(result, 'c').type, 'float');
  assert.equal(result.ast.body[2].initializer.inferredType, 'float');
  assert.ok(result.tokens.length > 0);
  assert.ok(Number.isFinite(result.compilationTimeMs));
});