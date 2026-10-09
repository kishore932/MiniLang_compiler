import { examples } from '../data/examples.js';

export default function ProblemPanel({ selectedExample, onSelect }) {
  const codeExamples = examples.filter((item) => item.category === 'examples');
  const errorExamples = examples.filter((item) => item.category === 'errors');

  return (
    <aside className="lc-problem-panel">
      <div className="lc-panel-header">
        <span className="lc-tab lc-tab--active">Description</span>
      </div>
      <div className="lc-problem-content">
        <h1 className="lc-problem-title"># MiniLang Compiler</h1>

        <section className="lc-problem-section">
          <h2>Description</h2>
          <p>
            MiniLang is an imperative programming language designed to demonstrate an end-to-end multi-stage compiler pipeline.
            Compile source code down to pseudo-assembly (MiniASM) or execute TAC directly with detailed phase-by-phase diagnostics.
          </p>
        </section>

        <section className="lc-problem-section">
          <h2>Language Rules</h2>
          <ul className="lc-rules-list">
            <li><code>let variable = expr;</code> &mdash; Variable declaration with static type inference</li>
            <li><code>variable = expr;</code> &mdash; Variable assignment</li>
            <li><code>print expr;</code> &mdash; Output expression result</li>
            <li><code>if (condition) {'{'} ... {'}'} else {'{'} ... {'}'}</code> &mdash; Control flow branching</li>
            <li><code>while (condition) {'{'} ... {'}'}</code> &mdash; Iterative loop</li>
            <li><strong>Operators:</strong> <code>+</code> <code>-</code> <code>*</code> <code>/</code> <code>=</code> <code>&gt;</code> <code>&lt;</code> <code>&gt;=</code> <code>&lt;=</code> <code>==</code> <code>!=</code></li>
            <li><strong>Types:</strong> <code>int</code>, <code>float</code> (automatic promotion for mixed arithmetic)</li>
            <li><strong>Comments:</strong> <code>// single line comment</code></li>
          </ul>
        </section>

        <section className="lc-problem-section">
          <h2>Examples</h2>
          <div className="lc-example-grid">
            {codeExamples.map((example) => {
              const isActive = selectedExample === example.id;
              return (
                <button
                  type="button"
                  key={example.id}
                  className={`lc-example-card ${isActive ? 'is-active' : ''}`}
                  onClick={() => onSelect(example)}
                >
                  <span className="lc-example-badge">{example.id}</span>
                  <span className="lc-example-name">{example.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="lc-problem-section">
          <h2>Error Test Cases</h2>
          <div className="lc-example-grid">
            {errorExamples.map((example) => {
              const isActive = selectedExample === example.id;
              return (
                <button
                  type="button"
                  key={example.id}
                  className={`lc-example-card lc-example-card--error ${isActive ? 'is-active' : ''}`}
                  onClick={() => onSelect(example)}
                >
                  <span className="lc-example-badge">{example.id}</span>
                  <span className="lc-example-name">{example.name}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </aside>
  );
}
