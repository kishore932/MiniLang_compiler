import { useState } from 'react';

export default function TacViewer({ result }) {
  const [mode, setMode] = useState('structured');
  const [copyState, setCopyState] = useState('Copy');

  if (!result) {
    return <div className="empty-state">No intermediate code generated yet.<br />Compile your MiniLang program to view TAC.</div>;
  }

  if (!result.tacGenerationPerformed || !result.intermediateCode) {
    return <div className="empty-state">TAC was not generated because an earlier compiler phase reported errors.</div>;
  }

  const { instructions, formattedCode } = result.intermediateCode;
  if (instructions.length === 0) {
    return <div className="empty-state">No TAC instructions were generated for this program.</div>;
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(formattedCode);
      setCopyState('Copied');
      window.setTimeout(() => setCopyState('Copy'), 1400);
    } catch {
      setCopyState('Copy unavailable');
      window.setTimeout(() => setCopyState('Copy'), 1600);
    }
  };

  return (
    <div className="tac-view" role="tabpanel">
      <div className="tac-toolbar">
        <div className="tac-modes" role="group" aria-label="TAC display mode">
          <button className={mode === 'structured' ? 'tac-mode tac-mode--active' : 'tac-mode'} type="button" onClick={() => setMode('structured')}>Structured View</button>
          <button className={mode === 'code' ? 'tac-mode tac-mode--active' : 'tac-mode'} type="button" onClick={() => setMode('code')}>Code View</button>
        </div>
        <div className="tac-summary">{result.intermediateCode.temporaries} temps · {result.intermediateCode.labels} labels</div>
        {mode === 'code' && <button className="copy-tac" type="button" onClick={copyCode} aria-label="Copy formatted TAC">{copyState}</button>}
      </div>
      {mode === 'structured' ? (
        <div className="output-scroll">
          <table className="tac-table">
            <thead><tr><th>#</th><th>Operation</th><th>Argument 1</th><th>Argument 2</th><th>Result</th></tr></thead>
            <tbody>
              {instructions.map((instruction) => (
                <tr key={instruction.index}>
                  <td>{instruction.index}</td>
                  <td><span className="tac-operation">{instruction.op}</span></td>
                  <td className="code-value">{instruction.arg1 ?? ''}</td>
                  <td className="code-value">{instruction.arg2 ?? ''}</td>
                  <td className="code-value">{instruction.result ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <pre className="tac-code">{formattedCode}</pre>
      )}
    </div>
  );
}