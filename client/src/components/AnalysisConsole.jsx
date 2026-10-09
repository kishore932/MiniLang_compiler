import { useState } from 'react';
import TreeView from './TreeView.jsx';
import { asArray, asString, formatTacLine, phaseOf } from '../lib/result.js';

const TABS = [
  { id: 'tokens', label: 'Tokens' },
  { id: 'syntaxTree', label: 'Syntax Tree' },
  { id: 'ast', label: 'AST' },
  { id: 'semantic', label: 'Semantic' },
  { id: 'symbolTable', label: 'Symbol Table' },
  { id: 'intermediateCode', label: 'Intermediate Code' },
  { id: 'tac', label: 'TAC' },
  { id: 'optimization', label: 'Optimization' },
  { id: 'targetCode', label: 'Target Code' },
  { id: 'errors', label: 'Errors' },
];

const PIPELINE_PHASES = [
  { key: 'lexer', label: 'Lexer' },
  { key: 'parser', label: 'Parser' },
  { key: 'ast', label: 'AST' },
  { key: 'semantic', label: 'Semantic' },
  { key: 'ir', label: 'IR' },
  { key: 'optimization', label: 'Optimization' },
  { key: 'targetCode', label: 'Target' },
];

function EmptyState({ title, text }) {
  return (
    <div className="lc-empty-state">
      <div className="lc-empty-title">{title}</div>
      <div className="lc-empty-text">{text}</div>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" className="lc-btn-small" onClick={handleCopy}>
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function TokensTab({ result }) {
  const tokens = asArray(result?.tokens);
  if (!result) return <EmptyState title="No Tokens" text="Click Compile to generate lexer tokens." />;
  if (tokens.length === 0) return <EmptyState title="Empty Tokens" text="The lexer emitted no tokens." />;

  return (
    <div className="lc-table-wrapper">
      <table className="lc-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Type</th>
            <th>Value</th>
            <th>Line</th>
            <th>Column</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token, index) => (
            <tr key={`${token.type}-${token.line}-${token.column}-${index}`}>
              <td>{index + 1}</td>
              <td className="lc-type-tag">{token.type ?? '—'}</td>
              <td className="lc-code-val">{asString(token.value)}</td>
              <td>{token.line ?? '—'}</td>
              <td>{token.column ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TreePanel({ result, tree, emptyTitle, emptyText }) {
  const [viewMode, setViewMode] = useState('tree');
  const [expandAll, setExpandAll] = useState(true);
  const [revision, setRevision] = useState(0);

  if (!result) return <EmptyState title={emptyTitle} text="Click Compile to view tree structure." />;
  if (!tree) return <EmptyState title={emptyTitle} text={emptyText} />;

  return (
    <div className="lc-phase-container">
      <div className="lc-phase-toolbar">
        <div className="lc-button-group">
          <button
            type="button"
            className="lc-btn-small"
            onClick={() => {
              setExpandAll(true);
              setRevision((r) => r + 1);
            }}
          >
            Expand All
          </button>
          <button
            type="button"
            className="lc-btn-small"
            onClick={() => {
              setExpandAll(false);
              setRevision((r) => r + 1);
            }}
          >
            Collapse All
          </button>
        </div>
        <div className="lc-button-group">
          <button
            type="button"
            className={`lc-btn-small ${viewMode === 'tree' ? 'is-active' : ''}`}
            onClick={() => setViewMode('tree')}
          >
            Tree
          </button>
          <button
            type="button"
            className={`lc-btn-small ${viewMode === 'json' ? 'is-active' : ''}`}
            onClick={() => setViewMode('json')}
          >
            JSON
          </button>
        </div>
      </div>
      <div className="lc-phase-content">
        {viewMode === 'json' ? (
          <pre className="lc-code-block">{JSON.stringify(tree, null, 2)}</pre>
        ) : (
          <TreeView tree={tree} expandAll={expandAll} revision={revision} />
        )}
      </div>
    </div>
  );
}

function SemanticTab({ result }) {
  if (!result) return <EmptyState title="Semantic Analysis" text="Click Compile to run semantic analysis." />;
  if (!result.semanticAnalysisPerformed) {
    return <EmptyState title="Not Run" text="Semantic analysis did not run because an earlier stage failed." />;
  }

  const errors = asArray(result.semantic?.errors ?? result.semanticErrors);
  const warnings = asArray(result.semantic?.warnings ?? result.warnings);

  if (errors.length === 0 && warnings.length === 0) {
    return (
      <div className="lc-success-banner">
        <span className="lc-icon">✓</span> Semantic analysis passed cleanly without errors or warnings.
      </div>
    );
  }

  return (
    <div className="lc-diagnostics-list">
      {errors.map((error, index) => (
        <div className="lc-diag-card lc-diag-card--error" key={`err-${index}`}>
          <div className="lc-diag-header">
            <span className="lc-diag-type">{error.type || 'SEMANTIC_ERROR'}</span>
            <span className="lc-diag-loc">Line {error.line ?? '—'}, Column {error.column ?? '—'}</span>
          </div>
          <div className="lc-diag-msg">{error.message}</div>
        </div>
      ))}
      {warnings.map((warning, index) => (
        <div className="lc-diag-card lc-diag-card--warning" key={`warn-${index}`}>
          <div className="lc-diag-header">
            <span className="lc-diag-type">{warning.type || 'WARNING'}</span>
            <span className="lc-diag-loc">Line {warning.line ?? '—'}, Column {warning.column ?? '—'}</span>
          </div>
          <div className="lc-diag-msg">{warning.message}</div>
        </div>
      ))}
    </div>
  );
}

function SymbolTableTab({ result }) {
  const symbols = asArray(result?.symbolTable);

  if (!result) return <EmptyState title="Symbol Table" text="Click Compile to inspect symbol table." />;
  if (phaseOf(result, 'semantic') === 'not-run') {
    return <EmptyState title="Not Run" text="Symbol table is constructed during semantic analysis." />;
  }
  if (symbols.length === 0) return <EmptyState title="No Symbols" text="No variables declared in source code." />;

  return (
    <div className="lc-table-wrapper">
      <table className="lc-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Initialized</th>
            <th>Scope</th>
            <th>Declared At</th>
          </tr>
        </thead>
        <tbody>
          {symbols.map((sym, index) => (
            <tr key={`${sym.name}-${sym.scope}-${index}`}>
              <td className="lc-code-val">{sym.name}</td>
              <td>
                <span className={`lc-type-badge lc-type-badge--${sym.type}`}>
                  {sym.type ?? 'unknown'}
                </span>
              </td>
              <td>{sym.initialized ? 'Yes' : 'No'}</td>
              <td>{sym.scope ?? '—'}</td>
              <td>Line {sym.declarationLine ?? '—'}, Col {sym.declarationColumn ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IntermediateTab({ result }) {
  const instructions = asArray(result?.intermediateCode?.instructions);

  if (!result) return <EmptyState title="Intermediate Code" text="Click Compile to generate IR." />;
  if (!result.tacGenerationPerformed || !result.intermediateCode) {
    return <EmptyState title="Not Generated" text="IR generation skipped because an earlier stage failed." />;
  }
  if (instructions.length === 0) return <EmptyState title="Empty IR" text="No intermediate instructions produced." />;

  return (
    <div className="lc-phase-container">
      <div className="lc-phase-toolbar">
        <span className="lc-meta-info">
          Temporaries: {result.intermediateCode.temporaries ?? 0} &nbsp;|&nbsp; Labels: {result.intermediateCode.labels ?? 0}
        </span>
      </div>
      <div className="lc-table-wrapper">
        <table className="lc-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Op</th>
              <th>Arg1</th>
              <th>Arg2</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {instructions.map((inst, index) => (
              <tr key={`ir-${index}`}>
                <td>{inst.index ?? index + 1}</td>
                <td className="lc-code-val">{inst.op}</td>
                <td className="lc-code-val">{asString(inst.arg1)}</td>
                <td className="lc-code-val">{asString(inst.arg2)}</td>
                <td className="lc-code-val">{asString(inst.result)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TacTab({ result }) {
  const [viewMode, setViewMode] = useState('table');
  const instructions = asArray(result?.intermediateCode?.instructions);

  if (!result) return <EmptyState title="TAC" text="Click Compile to view Three-Address Code." />;
  if (!result.tacGenerationPerformed || !result.intermediateCode) {
    return <EmptyState title="Not Generated" text="TAC skipped due to earlier errors." />;
  }
  if (instructions.length === 0) return <EmptyState title="No TAC" text="No TAC instructions generated." />;

  const codeText = result.intermediateCode.formattedCode || instructions.map(formatTacLine).join('\n');

  return (
    <div className="lc-phase-container">
      <div className="lc-phase-toolbar">
        <div className="lc-button-group">
          <button
            type="button"
            className={`lc-btn-small ${viewMode === 'table' ? 'is-active' : ''}`}
            onClick={() => setViewMode('table')}
          >
            Table
          </button>
          <button
            type="button"
            className={`lc-btn-small ${viewMode === 'code' ? 'is-active' : ''}`}
            onClick={() => setViewMode('code')}
          >
            Code
          </button>
        </div>
        <CopyButton text={codeText} />
      </div>

      <div className="lc-phase-content">
        {viewMode === 'code' ? (
          <pre className="lc-code-block">{codeText}</pre>
        ) : (
          <div className="lc-table-wrapper">
            <table className="lc-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Op</th>
                  <th>Arg1</th>
                  <th>Arg2</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {instructions.map((inst, index) => (
                  <tr key={`tac-${index}`}>
                    <td>{inst.index ?? index + 1}</td>
                    <td className="lc-code-val">{inst.op}</td>
                    <td className="lc-code-val">{asString(inst.arg1)}</td>
                    <td className="lc-code-val">{asString(inst.arg2)}</td>
                    <td className="lc-code-val">{asString(inst.result)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function OptimizationTab({ result }) {
  const opt = result?.optimization;
  if (!result) return <EmptyState title="Optimization" text="Click Compile to run IR optimization." />;
  if (phaseOf(result, 'optimization') === 'not-run') {
    return <EmptyState title="Not Run" text="Optimization skipped because an earlier stage failed." />;
  }

  const before = asArray(opt?.originalInstructions);
  const after = asArray(opt?.optimizedInstructions);
  const applied = asArray(opt?.appliedOptimizations);
  const beforeText = opt?.formattedOriginal || before.map(formatTacLine).join('\n');
  const afterText = opt?.formattedOptimized || after.map(formatTacLine).join('\n');

  return (
    <div className="lc-opt-grid">
      <div className="lc-opt-col">
        <div className="lc-opt-heading">Before Optimization</div>
        <pre className="lc-code-block">{beforeText || '—'}</pre>
      </div>

      <div className="lc-opt-col lc-opt-col--middle">
        <div className="lc-opt-heading">Applied Transformations</div>
        <div className="lc-opt-summary">
          Removed <strong>{opt?.removedInstructions ?? 0}</strong> instruction(s)
        </div>
        {applied.length === 0 ? (
          <div className="lc-opt-empty">No optimizations were applicable.</div>
        ) : (
          <div className="lc-opt-list">
            {applied.map((entry, index) => (
              <div className="lc-opt-card" key={`${entry.rule}-${index}`}>
                <div className="lc-opt-rule">{entry.rule}</div>
                <div className="lc-opt-before"><code>{entry.before}</code></div>
                <div className="lc-opt-arrow">↓</div>
                <div className="lc-opt-after"><code>{entry.after}</code></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="lc-opt-col">
        <div className="lc-opt-heading">After Optimization</div>
        <pre className="lc-code-block">{afterText || '—'}</pre>
      </div>
    </div>
  );
}

function TargetCodeTab({ result }) {
  if (!result) return <EmptyState title="Target Code" text="Click Compile to generate target MiniASM code." />;
  if (phaseOf(result, 'targetCode') === 'not-run') {
    return <EmptyState title="Not Run" text="Target code generation skipped because earlier stages failed." />;
  }

  const lines = asArray(result.targetCode?.text);
  const fallback = asArray(result.targetCode?.instructions).map((i) => i.text).filter(Boolean);
  const asmText = (lines.length ? lines : fallback).join('\n');

  if (!asmText) return <EmptyState title="No Target Code" text="Generator produced 0 MiniASM instructions." />;

  return (
    <div className="lc-phase-container">
      <div className="lc-phase-toolbar">
        <span className="lc-meta-info">MiniASM Architecture</span>
        <CopyButton text={asmText} />
      </div>
      <div className="lc-phase-content">
        <pre className="lc-code-block">{asmText}</pre>
      </div>
    </div>
  );
}

function ErrorsTab({ result }) {
  const errors = asArray(result?.errors);
  if (!result) return <EmptyState title="Diagnostics" text="Click Compile to run lexical, syntax, and semantic checks." />;
  if (errors.length === 0) {
    return (
      <div className="lc-success-banner">
        <span className="lc-icon">✓</span> 0 compilation errors detected!
      </div>
    );
  }

  return (
    <div className="lc-diagnostics-list">
      {errors.map((err, index) => (
        <div className="lc-diag-card lc-diag-card--error" key={`err-${index}`}>
          <div className="lc-diag-header">
            <span className="lc-diag-type">{err.type || err.phase || 'COMPILATION_ERROR'}</span>
            <span className="lc-diag-loc">Line {err.line ?? '—'}, Column {err.column ?? '—'}</span>
          </div>
          <div className="lc-diag-msg">{err.message}</div>
        </div>
      ))}
    </div>
  );
}

function formatStatusIcon(status) {
  if (status === 'success') return '✓';
  if (status === 'failed') return '✕';
  return '○';
}

export default function AnalysisConsole({
  result,
  requestError,
  activeTab,
  onTabChange,
  runOutput,
}) {
  const errorsCount = asArray(result?.errors).length;

  return (
    <div className="lc-console">
      <div className="lc-console-header">
        <div className="lc-console-title">COMPILER ANALYSIS</div>
        <div className="lc-pipeline-bar" aria-label="Compiler Pipeline Status">
          {PIPELINE_PHASES.map((phase, index) => {
            const status = phaseOf(result, phase.key);
            return (
              <span key={phase.key} className={`lc-pipe-step lc-pipe-step--${status}`}>
                {index > 0 && <span className="lc-pipe-arrow">→</span>}
                <span className="lc-pipe-name">{phase.label}</span>
                <span className="lc-pipe-icon">{formatStatusIcon(status)}</span>
              </span>
            );
          })}
        </div>
      </div>

      <div className="lc-tabs-bar" role="tablist">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const isErrorTab = tab.id === 'errors';
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`lc-tab-item ${isActive ? 'is-active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
              {isErrorTab && errorsCount > 0 && (
                <span className="lc-badge-error">{errorsCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {runOutput && (
        <div className={`lc-run-output ${runOutput.error ? 'is-error' : ''}`}>
          <div className="lc-run-output-title">
            {runOutput.error ? 'RUNTIME ERROR' : 'EXECUTION STDOUT'}
          </div>
          <pre className="lc-code-block">{runOutput.error || runOutput.text || '(no output)'}</pre>
        </div>
      )}

      {requestError && (
        <div className="lc-request-error">
          <strong>Request Failed:</strong> {requestError}
        </div>
      )}

      <div className="lc-console-body">
        {activeTab === 'tokens' && <TokensTab result={result} />}
        {activeTab === 'syntaxTree' && (
          <TreePanel
            result={result}
            tree={result?.syntaxTree}
            emptyTitle="Syntax Tree"
            emptyText="No syntax tree generated because lexing or parsing failed."
          />
        )}
        {activeTab === 'ast' && (
          <TreePanel
            result={result}
            tree={result?.ast}
            emptyTitle="AST"
            emptyText="No AST generated because parsing failed."
          />
        )}
        {activeTab === 'semantic' && <SemanticTab result={result} />}
        {activeTab === 'symbolTable' && <SymbolTableTab result={result} />}
        {activeTab === 'intermediateCode' && <IntermediateTab result={result} />}
        {activeTab === 'tac' && <TacTab result={result} />}
        {activeTab === 'optimization' && <OptimizationTab result={result} />}
        {activeTab === 'targetCode' && <TargetCodeTab result={result} />}
        {activeTab === 'errors' && <ErrorsTab result={result} />}
      </div>
    </div>
  );
}
