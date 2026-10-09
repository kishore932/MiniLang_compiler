import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

test('POST /api/compile returns real tokens and stops before parsing lexical errors', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'let amount = 25.50; @' }),
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.ast, null);
    assert.deepEqual(result.tokens.find((token) => token.type === 'NUMBER'), {
      type: 'NUMBER', value: '25.50', line: 1, column: 14, numericType: 'float',
    });
    assert.deepEqual(result.errors, [{
      phase: 'lexical',
      type: 'LEXICAL_ERROR',
      message: "Unexpected character '@'",
      line: 1,
      column: 21,
    }]);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('POST /api/compile rejects requests without string source', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 42 }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { message: 'Request body must include source as a string.' });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('POST /api/compile returns a structured AST for valid source', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'let a = 1; let b = 2; let c = a + b * 2;' }),
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(result.errors, []);
    assert.equal(result.ast.type, 'Program');
    assert.deepEqual(result.semanticErrors, []);
    assert.equal(result.semanticAnalysisPerformed, true);
    assert.equal(result.symbolTable.length, 3);
    assert.equal(result.symbolTable[2].name, 'c');
    assert.equal(result.symbolTable[2].type, 'int');
    assert.ok(Number.isFinite(result.compilationTimeMs));
    assert.equal(result.tacGenerationPerformed, true);
    assert.deepEqual(result.intermediateCode.instructions.slice(2, 4).map((item) => item.op), ['*', '+']);
    assert.deepEqual(Object.keys(result.intermediateCode).sort(), ['formattedCode', 'instructions', 'labels', 'temporaries']);
    assert.equal(result.intermediateCode.formattedCode, 'a = 1\nb = 2\nt1 = b * 2\nt2 = a + t1\nc = t2');
    assert.equal(result.ast.body[2].initializer.operator, '+');
    assert.equal(result.ast.body[2].initializer.right.operator, '*');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});