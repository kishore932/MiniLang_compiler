import React, { useEffect, useMemo, useState } from 'react';
import AnalysisConsole from './components/AnalysisConsole.jsx';
import CodeEditor from './components/CodeEditor.jsx';
import ProblemPanel from './components/ProblemPanel.jsx';
import { DEFAULT_SOURCE } from './data/examples.js';
import { normalizeCompileResult } from './lib/result.js';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Compiler IDE ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="lc-crash-screen">
          <div className="lc-crash-box">
            <h2>IDE Render Error</h2>
            <pre>{this.state.error?.message || 'An unexpected rendering error occurred.'}</pre>
            <button
              type="button"
              className="lc-btn lc-btn--primary"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Reset Interface
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [backendStatus, setBackendStatus] = useState('checking');
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [selectedExample, setSelectedExample] = useState('03');
  const [result, setResult] = useState(null);
  const [requestError, setRequestError] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState('tokens');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fontSize, setFontSize] = useState(13);
  const [lastAction, setLastAction] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error('Health check failed');
        return res.json();
      })
      .then(() => {
        if (active) setBackendStatus('connected');
      })
      .catch(() => {
        if (active) setBackendStatus('unavailable');
      });
    return () => {
      active = false;
    };
  }, []);

  const runCompilePipeline = async (action) => {
    setBusy(true);
    setRequestError('');
    setLastAction(action);

    try {
      const response = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Compile request failed.');
      }
      const normalized = normalizeCompileResult(data);
      setResult(normalized);

      if (action === 'run') {
        setActiveTab(normalized.errors.length ? 'errors' : 'targetCode');
      }
    } catch (error) {
      setResult(null);
      setRequestError(error.message || 'Unable to communicate with compiler backend.');
    } finally {
      setBusy(false);
    }
  };

  const stats = result?.stats;

  const errorLines = useMemo(() => {
    if (!Array.isArray(result?.errors)) return [];
    return [...new Set(
      result.errors
        .map((err) => Number(err?.line))
        .filter((l) => Number.isFinite(l) && l > 0)
    )];
  }, [result]);

  return (
    <div className="lc-ide-layout">
      {/* Top Header */}
      <header className="lc-header">
        <div className="lc-brand">
          <span className="lc-logo-icon">⟨/⟩</span>
          <span className="lc-brand-title">MiniLang</span>
          <span className="lc-brand-divider">|</span>
          <span className="lc-brand-subtitle">Compiler Design</span>
        </div>

        <div className="lc-header-actions">
          <button
            type="button"
            className="lc-btn lc-btn--run"
            disabled={busy}
            onClick={() => runCompilePipeline('run')}
          >
            <span className="lc-btn-icon">▶</span> Run
          </button>

          <button
            type="button"
            className="lc-btn lc-btn--compile"
            disabled={busy}
            onClick={() => runCompilePipeline('compile')}
          >
            {busy ? 'Compiling…' : 'Compile'}
          </button>

          <button
            type="button"
            className={`lc-btn lc-btn--icon ${settingsOpen ? 'is-active' : ''}`}
            onClick={() => setSettingsOpen((prev) => !prev)}
            title="IDE Settings"
          >
            ⚙ Settings
          </button>
        </div>

        {settingsOpen && (
          <div className="lc-settings-popover">
            <div className="lc-settings-title">IDE Configuration</div>
            <div className="lc-settings-field">
              <label htmlFor="fontSizeSlider">Editor Font Size ({fontSize}px)</label>
              <input
                id="fontSizeSlider"
                type="range"
                min="12"
                max="18"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
              />
            </div>
            <div className="lc-settings-info">
              <div>Backend Status: <strong className={`lc-status--${backendStatus}`}>{backendStatus}</strong></div>
              <p>Shortcuts: <code>Ctrl + Enter</code> to Compile.</p>
              <p>Run compiles and executes MiniASM/TAC in the virtual machine.</p>
            </div>
          </div>
        )}
      </header>

      {/* Workspace Split Body */}
      <div className="lc-workspace">
        <div className="lc-top-split">
          <ProblemPanel
            selectedExample={selectedExample}
            onSelect={(example) => {
              setSelectedExample(example.id);
              setSource(example.source);
              setResult(null);
              setRequestError('');
            }}
          />

          <section className="lc-editor-panel">
            <div className="lc-panel-header">
              <span className="lc-tab lc-tab--active">CODE EDITOR</span>
              <span className="lc-lang-badge">MiniLang</span>
            </div>
            <CodeEditor
              source={source}
              fontSize={fontSize}
              errorLines={errorLines}
              onCompile={() => runCompilePipeline('compile')}
              onChange={(value) => {
                setSource(value);
                setSelectedExample('');
              }}
            />
          </section>
        </div>

        {/* Bottom Console */}
        <div className="lc-bottom-split">
          <AnalysisConsole
            result={result}
            requestError={requestError}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            runOutput={lastAction === 'run' && result?.execution?.ran ? result.execution : null}
          />
        </div>
      </div>

      {/* Footer Stats Bar */}
      <footer className="lc-stats-bar">
        <span className="lc-stat-item">Tokens <strong>{stats?.tokenCount ?? 0}</strong></span>
        <span className="lc-stat-sep">|</span>
        <span className="lc-stat-item">Syntax <strong>{stats?.syntaxNodeCount ?? 0}</strong></span>
        <span className="lc-stat-sep">|</span>
        <span className="lc-stat-item">AST <strong>{stats?.astNodeCount ?? 0}</strong></span>
        <span className="lc-stat-sep">|</span>
        <span className="lc-stat-item">Vars <strong>{stats?.variableCount ?? 0}</strong></span>
        <span className="lc-stat-sep">|</span>
        <span className="lc-stat-item">TAC <strong>{stats?.tacInstructionCount ?? 0}</strong></span>
        <span className="lc-stat-sep">|</span>
        <span className="lc-stat-item">Opt <strong>{stats?.optimizedInstructionCount ?? 0}</strong></span>
        <span className="lc-stat-sep">|</span>
        <span className="lc-stat-item">Target <strong>{stats?.targetInstructionCount ?? 0}</strong></span>
        <span className="lc-stat-sep">|</span>
        <span className={`lc-stat-item ${stats?.errorCount > 0 ? 'lc-stat-item--error' : ''}`}>
          Errors <strong>{stats?.errorCount ?? 0}</strong>
        </span>
        <span className="lc-stat-sep">|</span>
        <span className="lc-stat-item">{stats ? `${stats.compileTimeMs} ms` : 'Ready'}</span>
      </footer>
    </div>
  );
}
