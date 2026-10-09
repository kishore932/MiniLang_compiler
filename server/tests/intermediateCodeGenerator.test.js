import test from 'node:test';
import assert from 'node:assert/strict';
import { compileSource } from '../src/compiler/compile.js';
import {
  formatTacCode,
  generateThreeAddressCode,
} from '../src/compiler/intermediateCodeGenerator.js';

function generate(source) {
  const compiled = compileSource(source);
  assert.deepEqual(compiled.errors, []);
  return generateThreeAddressCode(compiled.ast);
}

test('lowers arithmetic according to AST precedence with dynamic temporaries', () => {
  const tac = generate('let a = 10;\nlet b = 20;\nlet c = a + b * 2;\nprint c;');

  assert.deepEqual(tac.errors, []);
  assert.equal(tac.temporaries, 2);
  assert.deepEqual(tac.instructions.map(({ op, arg1, arg2, result }) => ({ op, arg1, arg2, result })), [
    { op: '=', arg1: '10', arg2: null, result: 'a' },
    { op: '=', arg1: '20', arg2: null, result: 'b' },
    { op: '*', arg1: 'b', arg2: '2', result: 't1' },
    { op: '+', arg1: 'a', arg2: 't1', result: 't2' },
    { op: '=', arg1: 't2', arg2: null, result: 'c' },
    { op: 'PRINT', arg1: 'c', arg2: null, result: null },
  ]);
  assert.deepEqual(tac.instructions.map((instruction) => instruction.index), [1, 2, 3, 4, 5, 6]);
  assert.equal(formatTacCode(tac.instructions), [
    'a = 10', 'b = 20', 't1 = b * 2', 't2 = a + t1', 'c = t2', 'PRINT c',
  ].join('\n'));
});

test('preserves floating-point lexemes and lowers simple assignments directly', () => {
  const tac = generate('let a = 10;\nlet b = 20.50;\nb = 20;');

  assert.deepEqual(formatTacCode(tac.instructions), 'a = 10\nb = 20.50\nb = 20');
  assert.equal(tac.temporaries, 0);
});

test('preserves grouping order in multiplication expressions', () => {
  const tac = generate('let a = 1;\nlet b = 2;\nlet c = (a + b) * 2;');

  assert.deepEqual(formatTacCode(tac.instructions), 'a = 1\nb = 2\nt1 = a + b\nt2 = t1 * 2\nc = t2');
});

test('lowers unary minus, including a grouped operand', () => {
  const tac = generate('let a = 1;\nlet b = 2;\nlet x = -(a + b);');

  assert.deepEqual(tac.instructions.map(({ op, arg1, arg2, result }) => ({ op, arg1, arg2, result })), [
    { op: '=', arg1: '1', arg2: null, result: 'a' },
    { op: '=', arg1: '2', arg2: null, result: 'b' },
    { op: '+', arg1: 'a', arg2: 'b', result: 't1' },
    { op: 'NEGATE', arg1: 't1', arg2: null, result: 't2' },
    { op: '=', arg1: 't2', arg2: null, result: 'x' },
  ]);
  assert.equal(formatTacCode(tac.instructions), 'a = 1\nb = 2\nt1 = a + b\nt2 = -t1\nx = t2');
});

test('lowers comparisons and if-else with unique labels and conditional jumps', () => {
  const tac = generate('let x = 10;\nif (x > 5) { print x; } else { print 0; }');
  const instructions = tac.instructions;

  assert.equal(tac.labels, 2);
  assert.deepEqual(instructions.filter((item) => item.op === 'LABEL').map((item) => item.arg1), ['L1', 'L2']);
  assert.deepEqual(formatTacCode(instructions), [
    'x = 10',
    't1 = x > 5',
    'IF_FALSE t1 GOTO L1',
    'PRINT x',
    'GOTO L2',
    'L1:',
    'PRINT 0',
    'L2:',
  ].join('\n'));
});

test('lowers while loops with a condition, exit jump, body, and backward jump', () => {
  const tac = generate('let x = 0;\nwhile (x < 5) { x = x + 1; }');
  const instructions = tac.instructions;

  assert.equal(tac.labels, 2);
  assert.deepEqual(formatTacCode(instructions), [
    'x = 0',
    'L1:',
    't1 = x < 5',
    'IF_FALSE t1 GOTO L2',
    't2 = x + 1',
    'x = t2',
    'GOTO L1',
    'L2:',
  ].join('\n'));
  assert.ok(instructions.some((item) => item.op === 'GOTO' && item.arg1 === 'L1'));
});

test('generates unique labels and temporaries in nested control flow', () => {
  const tac = generate(`let x = 0;
while (x < 10) {
  if (x > 5) { print x; } else { print 0; }
  x = x + 1;
}`);
  const instructions = tac.instructions;
  const definitions = instructions.filter((item) => item.op === 'LABEL').map((item) => item.arg1);
  const targets = instructions
    .filter((item) => item.op === 'GOTO' || item.op === 'IF_FALSE')
    .map((item) => item.op === 'GOTO' ? item.arg1 : item.arg2);
  const temporaryResults = instructions
    .filter((item) => typeof item.result === 'string' && /^t\d+$/.test(item.result))
    .map((item) => item.result);

  assert.equal(new Set(definitions).size, definitions.length);
  assert.deepEqual([...new Set(targets)].filter((target) => !definitions.includes(target)), []);
  assert.equal(new Set(temporaryResults).size, temporaryResults.length);
  assert.equal(tac.labels, definitions.length);
  assert.equal(tac.temporaries, temporaryResults.length);
});

test('rejects non-Program input instead of inventing code', () => {
  assert.throws(() => generateThreeAddressCode(null), /validated Program AST/);
});