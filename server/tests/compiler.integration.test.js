import test from 'node:test';
import assert from 'node:assert/strict';
import { compileSource } from '../src/compiler/compile.js';

test('runs source through lexer, parser, and semantics to a structurally correct AST', () => {
  const result = compileSource('let a = 1; let b = 2; let c = a + b * 2;');

  assert.deepEqual(result.errors, []);
  assert.equal(result.tacGenerationPerformed, true);
  assert.equal(result.intermediateCode.temporaries, 2);
  assert.equal(result.intermediateCode.instructions[2].op, '*');
  assert.equal(result.intermediateCode.instructions[3].op, '+');
  assert.ok(result.tokens.some((token) => token.type === 'KEYWORD_LET'));
  assert.equal(result.symbolTable.length, 3);
  assert.deepEqual(result.ast.body[2], {
    type: 'VariableDeclaration',
    line: 1,
    column: 23,
    name: 'c',
    nameLine: 1,
    nameColumn: 27,
    initializer: {
      type: 'BinaryExpression',
      line: 1,
      column: 33,
      operator: '+',
      operatorType: 'PLUS',
      left: { type: 'Identifier', line: 1, column: 31, name: 'a', inferredType: 'int' },
      right: {
        type: 'BinaryExpression',
        line: 1,
        column: 37,
        operator: '*',
        operatorType: 'MULTIPLY',
        left: { type: 'Identifier', line: 1, column: 35, name: 'b', inferredType: 'int' },
        right: { type: 'NumberLiteral', line: 1, column: 39, value: '2', numericType: 'int', inferredType: 'int' },
        inferredType: 'int',
      },
      inferredType: 'int',
    },
    inferredType: 'int',
  });
});

test('does not invoke parsing when lexing reports invalid input', () => {
  const result = compileSource('let x = @;');

  assert.equal(result.ast, null);
  assert.equal(result.errors[0].phase, 'lexical');
  assert.equal(result.intermediateCode, null);
  assert.equal(result.tacGenerationPerformed, false);
});

test('skips TAC generation when semantic analysis fails', () => {
  const result = compileSource('let x = missing;');

  assert.equal(result.semanticAnalysisPerformed, true);
  assert.equal(result.intermediateCode, null);
  assert.equal(result.tacGenerationPerformed, false);
  assert.equal(result.errors[0].phase, 'semantic');
});

test('compiles the complete sample through TAC with unique labels and temporaries', () => {
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
  const result = compileSource(source);
  const instructions = result.intermediateCode.instructions;
  const labels = instructions.filter((item) => item.op === 'LABEL').map((item) => item.arg1);
  const temporaryResults = instructions
    .filter((item) => typeof item.result === 'string' && /^t\d+$/.test(item.result))
    .map((item) => item.result);

  assert.deepEqual(result.errors, []);
  assert.equal(result.tacGenerationPerformed, true);
  assert.equal(result.symbolTable.find((symbol) => symbol.name === 'c').type, 'float');
  assert.ok(instructions.some((item) => item.op === 'IF_FALSE'));
  assert.ok(instructions.some((item) => item.op === 'GOTO'));
  assert.equal(new Set(labels).size, labels.length);
  assert.equal(new Set(temporaryResults).size, temporaryResults.length);
  assert.equal(result.intermediateCode.temporaries, temporaryResults.length);
  assert.equal(result.intermediateCode.labels, new Set(labels).size);
});

test('runs optimization and target code generation after successful semantic analysis', () => {
  const source = 'let a = 10; let b = 20; let c = a + b * 2; print c;';
  const result = compileSource(source);

  assert.deepEqual(result.errors, []);
  assert.equal(result.phaseStatus.optimizer, 'success');
  assert.equal(result.phaseStatus.targetCode, 'success');
  assert.ok(Array.isArray(result.optimization.appliedOptimizations));
  assert.ok(Array.isArray(result.optimization.optimizedInstructions));
  assert.ok(Array.isArray(result.targetCode.instructions));
  assert.ok(result.targetCode.text.length > 0);
  assert.ok(result.targetCode.instructions.some((instruction) => instruction.op === 'PRINT'));
});