import { performance } from 'node:perf_hooks';
import { tokenize } from './lexer.js';
import { parse } from './parser.js';
import { analyzeSemantics } from './semanticAnalyzer.js';
import { generateThreeAddressCode } from './intermediateCodeGenerator.js';
import { optimizeThreeAddressCode } from './optimizer.js';
import { generateTargetCode } from './targetCodeGenerator.js';
import { executeTac } from './interpreter.js';

function countNodes(value) {
  if (!value || typeof value !== 'object') return 0;
  if (Array.isArray(value)) return value.reduce((total, entry) => total + countNodes(entry), 0);

  const childValues = Object.values(value).flatMap((entry) => {
    if (Array.isArray(entry)) return entry;
    if (entry && typeof entry === 'object') return [entry];
    return [];
  });

  return 1 + childValues.reduce((total, child) => total + countNodes(child), 0);
}

function emptyOptimization() {
  return {
    originalInstructions: [],
    optimizedInstructions: [],
    appliedOptimizations: [],
    removedInstructions: 0,
    formattedOriginal: '',
    formattedOptimized: '',
  };
}

function emptyTargetCode() {
  return {
    instructions: [],
    text: [],
    registers: [],
    labels: [],
  };
}

function emptyExecution() {
  return {
    ran: false,
    output: [],
    text: '',
    error: null,
  };
}

function createPhaseStatus() {
  return {
    lexer: 'not_run',
    parser: 'not_run',
    ast: 'not_run',
    semantic: 'not_run',
    intermediateCode: 'not_run',
    ir: 'not_run',
    optimizer: 'not_run',
    optimization: 'not_run',
    targetCode: 'not_run',
  };
}

function finalizeResult(result, startedAt) {
  const intermediateCode = result.intermediateCode && typeof result.intermediateCode === 'object'
    ? result.intermediateCode
    : {};
  const optimization = result.optimization && typeof result.optimization === 'object'
    ? result.optimization
    : emptyOptimization();
  const targetCode = result.targetCode && typeof result.targetCode === 'object'
    ? result.targetCode
    : emptyTargetCode();
  const errorList = Array.isArray(result.errors) ? result.errors : [];

  result.stats = {
    tokenCount: Array.isArray(result.tokens) ? result.tokens.length : 0,
    syntaxNodeCount: countNodes(result.syntaxTree),
    astNodeCount: countNodes(result.ast),
    variableCount: Array.isArray(result.symbolTable) ? result.symbolTable.length : 0,
    tacInstructionCount: Array.isArray(intermediateCode.instructions) ? intermediateCode.instructions.length : 0,
    optimizedInstructionCount: Array.isArray(optimization.optimizedInstructions) ? optimization.optimizedInstructions.length : 0,
    targetInstructionCount: Array.isArray(targetCode.instructions) ? targetCode.instructions.length : 0,
    errorCount: errorList.length,
    compileTimeMs: Math.round(performance.now() - startedAt),
  };

  result.compilationTimeMs = result.stats.compileTimeMs;
  result.semanticErrors = Array.isArray(result.semantic?.errors) ? result.semantic.errors : result.semanticErrors ?? [];
  result.warnings = Array.isArray(result.semantic?.warnings) ? result.semantic.warnings : result.warnings ?? [];
  result.semantic = {
    errors: result.semanticErrors,
    warnings: result.warnings,
  };

  if (result.intermediateCode === undefined) {
    result.intermediateCode = null;
  }

  if (!result.optimization || typeof result.optimization !== 'object') {
    result.optimization = emptyOptimization();
  }

  if (!result.targetCode || typeof result.targetCode !== 'object') {
    result.targetCode = emptyTargetCode();
  }

  if (!result.execution || typeof result.execution !== 'object') {
    result.execution = emptyExecution();
  }

  return result;
}

export function compileSource(source) {
  const startedAt = performance.now();

  const result = {
    source,
    tokens: [],
    syntaxTree: null,
    ast: null,
    semantic: { errors: [], warnings: [] },
    symbolTable: [],
    intermediateCode: null,
    optimization: emptyOptimization(),
    targetCode: emptyTargetCode(),
    execution: emptyExecution(),
    semanticErrors: [],
    warnings: [],
    errors: [],
    phaseStatus: createPhaseStatus(),
    semanticAnalysisPerformed: false,
    tacGenerationPerformed: false,
  };

  const { tokens, errors: lexicalErrors } = tokenize(source);
  result.tokens = tokens;
  result.phaseStatus.lexer = lexicalErrors.length > 0 ? 'failed' : 'success';
  if (lexicalErrors.length > 0) {
    result.errors = lexicalErrors;
    return finalizeResult(result, startedAt);
  }

  const { ast, syntaxTree, errors: syntaxErrors } = parse(tokens);
  result.ast = ast ?? null;
  result.syntaxTree = syntaxTree ?? null;
  result.phaseStatus.parser = syntaxErrors.length > 0 ? 'failed' : 'success';
  result.phaseStatus.ast = syntaxErrors.length > 0 || !ast ? 'failed' : 'success';
  if (syntaxErrors.length > 0) {
    result.errors = syntaxErrors;
    return finalizeResult(result, startedAt);
  }

  const { symbolTable, semanticErrors, warnings } = analyzeSemantics(ast);
  result.symbolTable = symbolTable;
  result.semanticErrors = semanticErrors;
  result.warnings = warnings;
  result.semantic = { errors: semanticErrors, warnings };
  result.semanticAnalysisPerformed = true;
  result.phaseStatus.semantic = semanticErrors.length > 0 ? 'failed' : 'success';

  if (semanticErrors.length > 0) {
    result.errors = semanticErrors;
    return finalizeResult(result, startedAt);
  }

  const generatedCode = generateThreeAddressCode(ast);
  const { errors: tacErrors, ...intermediateCode } = generatedCode;
  result.intermediateCode = intermediateCode;
  const irFailed = tacErrors.length > 0;
  result.phaseStatus.intermediateCode = irFailed ? 'failed' : 'success';
  result.phaseStatus.ir = irFailed ? 'failed' : 'success';
  result.tacGenerationPerformed = !irFailed;

  if (irFailed) {
    result.errors = tacErrors;
    return finalizeResult(result, startedAt);
  }

  try {
    const optimizedCode = optimizeThreeAddressCode(intermediateCode.instructions ?? []);
    result.optimization = {
      originalInstructions: optimizedCode.originalInstructions,
      optimizedInstructions: optimizedCode.optimizedInstructions,
      appliedOptimizations: optimizedCode.appliedOptimizations,
      removedInstructions: optimizedCode.removedInstructions,
      formattedOriginal: optimizedCode.formattedOriginal,
      formattedOptimized: optimizedCode.formattedOptimized,
    };
    result.phaseStatus.optimizer = 'success';
    result.phaseStatus.optimization = 'success';
  } catch (error) {
    result.errors = [{
      phase: 'optimization',
      type: 'OPTIMIZATION_ERROR',
      message: error.message || 'Optimization failed.',
      line: 1,
      column: 1,
    }];
    result.phaseStatus.optimizer = 'failed';
    result.phaseStatus.optimization = 'failed';
    return finalizeResult(result, startedAt);
  }

  try {
    const targetCode = generateTargetCode(result.optimization.optimizedInstructions ?? []);
    result.targetCode = {
      instructions: targetCode.instructions,
      text: targetCode.text,
      registers: targetCode.registers,
      labels: targetCode.labels,
    };
    result.phaseStatus.targetCode = 'success';
  } catch (error) {
    result.errors = [{
      phase: 'target',
      type: 'TARGET_CODE_ERROR',
      message: error.message || 'Target code generation failed.',
      line: 1,
      column: 1,
    }];
    result.phaseStatus.targetCode = 'failed';
    return finalizeResult(result, startedAt);
  }

  result.execution = executeTac(result.optimization.optimizedInstructions ?? []);
  result.errors = [];
  return finalizeResult(result, startedAt);
}
