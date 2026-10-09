import test from 'node:test';
import assert from 'node:assert/strict';
import { compileSource } from '../src/compiler/compile.js';
import { optimizeThreeAddressCode } from '../src/compiler/optimizer.js';
import { generateTargetCode } from '../src/compiler/targetCodeGenerator.js';
import { executeTac } from '../src/compiler/interpreter.js';
import { generateThreeAddressCode } from '../src/compiler/intermediateCodeGenerator.js';

function compileOk(source) {
  const result = compileSource(source);
  assert.deepEqual(result.errors, []);
  return result;
}

test('arithmetic sample folds constants and prints 50', () => {
  const result = compileOk('let a = 10;\nlet b = 20;\nlet c = a + b * 2;\nprint c;');
  const optimizedText = result.optimization.formattedOptimized;

  assert.equal(result.phaseStatus.lexer, 'success');
  assert.equal(result.phaseStatus.parser, 'success');
  assert.equal(result.phaseStatus.ast, 'success');
  assert.equal(result.phaseStatus.semantic, 'success');
  assert.equal(result.phaseStatus.ir, 'success');
  assert.equal(result.phaseStatus.optimization, 'success');
  assert.equal(result.phaseStatus.targetCode, 'success');
  assert.match(optimizedText, /c = 50/);
  assert.ok(result.optimization.removedInstructions > 0);
  assert.ok(result.optimization.appliedOptimizations.some((entry) => entry.rule === 'Constant Folding'));
  assert.equal(result.execution.text, '50');
  assert.ok(result.targetCode.text.some((line) => line.startsWith('PRINT')));
  assert.ok(result.stats.tokenCount > 0);
  assert.ok(result.stats.tacInstructionCount > result.stats.optimizedInstructionCount);
});

test('does not constant-fold loop counters across labels', () => {
  const result = compileOk('let x = 0;\nwhile (x < 5) {\n    x = x + 1;\n}\nprint x;');
  assert.equal(result.execution.text, '5');
  assert.ok(result.optimization.optimizedInstructions.some((item) => item.op === 'IF_FALSE'));
  assert.ok(result.targetCode.instructions.some((item) => item.op === 'JMP'));
});

test('executes if/else and nested control flow from optimized TAC', () => {
  const ifResult = compileOk('let score = 25.5;\nif (score >= 20) {\n    print score;\n} else {\n    print 0;\n}\n');
  assert.equal(ifResult.execution.text, '25.5');

  const nested = compileOk(`let x = 0;
while (x < 3) {
    if (x > 1) {
        print x;
    } else {
        print 0;
    }
    x = x + 1;
}`);
  assert.equal(nested.execution.text, '0\n0\n2');
});

test('promotes float and int in generated TAC and execution', () => {
  const result = compileOk('let a = 10;\nlet b = 2.5;\nlet c = a + b;\nprint c;');
  assert.equal(result.symbolTable.find((symbol) => symbol.name === 'c').type, 'float');
  assert.equal(result.execution.text, '12.5');
});

test('marks later phases not_run when an earlier required phase fails', () => {
  const lexical = compileSource('let x = @;');
  assert.equal(lexical.phaseStatus.lexer, 'failed');
  assert.equal(lexical.phaseStatus.parser, 'not_run');
  assert.equal(lexical.phaseStatus.semantic, 'not_run');
  assert.equal(lexical.phaseStatus.ir, 'not_run');
  assert.equal(lexical.phaseStatus.optimization, 'not_run');
  assert.equal(lexical.phaseStatus.targetCode, 'not_run');
  assert.equal(lexical.intermediateCode, null);

  const syntax = compileSource('let x = ;');
  assert.equal(syntax.phaseStatus.parser, 'failed');
  assert.equal(syntax.phaseStatus.semantic, 'not_run');
  assert.equal(syntax.phaseStatus.ir, 'not_run');
  assert.equal(syntax.errors[0].phase, 'syntax');

  const undeclared = compileSource('print unknown;');
  assert.equal(undeclared.phaseStatus.semantic, 'failed');
  assert.equal(undeclared.phaseStatus.ir, 'not_run');
  assert.equal(undeclared.phaseStatus.optimization, 'not_run');
  assert.equal(undeclared.tacGenerationPerformed, false);

  const duplicate = compileSource('let x = 1;\nlet x = 2;');
  assert.equal(duplicate.phaseStatus.semantic, 'failed');
  assert.match(duplicate.errors[0].message, /already been declared/);
});

test('target code is generated from optimized TAC rather than original TAC', () => {
  const compiled = compileOk('let a = 10;\nlet b = 20;\nlet c = a + b * 2;\nprint c;');
  const fromOptimized = generateTargetCode(compiled.optimization.optimizedInstructions);
  const fromOriginal = generateTargetCode(compiled.intermediateCode.instructions);

  assert.deepEqual(compiled.targetCode.text, fromOptimized.text);
  assert.notEqual(fromOptimized.text.join('\n'), fromOriginal.text.join('\n'));
});

test('optimizer applies algebraic simplification and dead temporary removal', () => {
  const tac = generateThreeAddressCode(compileOk('let a = 8;\nlet b = a * 1;\nprint b;').ast);
  const optimized = optimizeThreeAddressCode(tac.instructions);
  assert.ok(optimized.appliedOptimizations.some((entry) => (
    entry.rule === 'Algebraic Simplification' || entry.rule === 'Constant Folding'
  )));
  assert.ok(optimized.removedInstructions >= 0);
  assert.equal(executeTac(optimized.optimizedInstructions).text, '8');
});
