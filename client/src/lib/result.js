export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function asString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export function phaseOf(result, key) {
  const status = result?.phaseStatus?.[key];
  if (status === 'success' || status === 'failed') return status;
  if (status === 'not_run' || status === 'not-run') return 'not-run';
  return 'not-run';
}

export function countTreeNodes(value) {
  if (!value || typeof value !== 'object') return 0;
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + countTreeNodes(item), 0);
  }
  const childValues = Object.values(value).flatMap((entry) => {
    if (Array.isArray(entry)) return entry;
    if (entry && typeof entry === 'object') return [entry];
    return [];
  });
  return 1 + childValues.reduce((total, child) => total + countTreeNodes(child), 0);
}

export function formatTacLine(instruction) {
  if (!instruction || typeof instruction !== 'object') return '';
  const { op, arg1, arg2, result } = instruction;
  if (op === '=') return `${result} = ${arg1}`;
  if (op === 'NEGATE') return `${result} = -${arg1}`;
  if (op === 'PRINT') return `PRINT ${arg1 ?? ''}`;
  if (op === 'LABEL') return `${arg1}:`;
  if (op === 'GOTO') return `GOTO ${arg1}`;
  if (op === 'IF_FALSE') return `IF_FALSE ${arg1} GOTO ${arg2}`;
  if (result) return `${result} = ${arg1 ?? ''} ${op} ${arg2 ?? ''}`.trim();
  return `${op ?? ''} ${arg1 ?? ''} ${arg2 ?? ''}`.trim();
}

export function normalizeCompileResult(data) {
  const result = asObject(data);
  const intermediateCode = result.intermediateCode && typeof result.intermediateCode === 'object'
    ? result.intermediateCode
    : null;
  const optimization = asObject(result.optimization);
  const targetCode = asObject(result.targetCode);
  const semantic = asObject(result.semantic);
  const stats = asObject(result.stats);
  const execution = asObject(result.execution);

  return {
    ...result,
    tokens: asArray(result.tokens),
    syntaxTree: result.syntaxTree ?? null,
    ast: result.ast ?? null,
    symbolTable: asArray(result.symbolTable),
    errors: asArray(result.errors),
    semanticErrors: asArray(result.semanticErrors ?? semantic.errors),
    warnings: asArray(result.warnings ?? semantic.warnings),
    semantic: {
      errors: asArray(semantic.errors ?? result.semanticErrors),
      warnings: asArray(semantic.warnings ?? result.warnings),
    },
    intermediateCode,
    optimization: {
      originalInstructions: asArray(optimization.originalInstructions),
      optimizedInstructions: asArray(optimization.optimizedInstructions),
      appliedOptimizations: asArray(optimization.appliedOptimizations),
      removedInstructions: Number(optimization.removedInstructions) || 0,
      formattedOriginal: asString(optimization.formattedOriginal),
      formattedOptimized: asString(optimization.formattedOptimized),
    },
    targetCode: {
      instructions: asArray(targetCode.instructions),
      text: asArray(targetCode.text),
      registers: asArray(targetCode.registers),
      labels: asArray(targetCode.labels),
    },
    execution: {
      ran: Boolean(execution.ran),
      output: asArray(execution.output),
      text: asString(execution.text),
      error: execution.error ?? null,
    },
    phaseStatus: asObject(result.phaseStatus),
    stats: {
      tokenCount: Number(stats.tokenCount) || asArray(result.tokens).length,
      syntaxNodeCount: Number(stats.syntaxNodeCount) || countTreeNodes(result.syntaxTree),
      astNodeCount: Number(stats.astNodeCount) || countTreeNodes(result.ast),
      variableCount: Number(stats.variableCount) || asArray(result.symbolTable).length,
      tacInstructionCount: Number(stats.tacInstructionCount) || asArray(intermediateCode?.instructions).length,
      optimizedInstructionCount: Number(stats.optimizedInstructionCount) || asArray(optimization.optimizedInstructions).length,
      targetInstructionCount: Number(stats.targetInstructionCount) || asArray(targetCode.instructions).length,
      errorCount: Number(stats.errorCount) || asArray(result.errors).length,
      compileTimeMs: Number(stats.compileTimeMs ?? result.compilationTimeMs) || 0,
    },
    tacGenerationPerformed: Boolean(result.tacGenerationPerformed),
    semanticAnalysisPerformed: Boolean(result.semanticAnalysisPerformed),
  };
}
