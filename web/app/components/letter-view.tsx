import { wordCount, type LetterResult } from '../../lib/letters';
import { CopyText } from './copy-text';

// The letters are plain Markdown written by the agent: paragraphs and **bold**.
// Rendered as text nodes, never as HTML, so nothing in a file can inject markup.
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

function Lines({ text }: { text: string }) {
  const lines = text.split('\n');
  return <>{lines.map((line, i) => <span key={i}>{inline(line)}{i < lines.length - 1 && <br />}</span>)}</>;
}

// The brief is "Label: text" blocks separated by blank lines. The first line
// ("Job id: ...") only links the file to a job, so it is left out.
function parseBrief(text: string): { label: string; body: string }[] {
  return text
    .trim()
    .split(/\n{2,}/)
    .flatMap((block) => {
      const m = /^([A-Z][^:\n]{1,40}):\s*([\s\S]*)$/.exec(block.trim());
      return m && m[1] !== 'Job id' ? [{ label: m[1]!, body: m[2]!.trim() }] : [];
    });
}

export function LetterView({ result }: { result: LetterResult }) {
  if (!result.ok) {
    return (
      <div>
        <p className="muted">{result.reason}</p>
        <p className="hint"><code>{result.path}</code></p>
      </div>
    );
  }

  const paragraphs = result.letter.trim().split(/\n{2,}/);
  const brief = result.brief ? parseBrief(result.brief) : [];

  return (
    <div className="letter-wrap">
      <div className="letter-bar">
        <span className="meta">{wordCount(result.letter)} words · <code>{result.path}</code></span>
        <CopyText text={result.letter.trim()} label="Copy letter" />
      </div>

      <div className="letter">
        {paragraphs.map((p, i) => (
          <p key={i} className={i === 0 ? 'letter-from' : undefined}><Lines text={p} /></p>
        ))}
      </div>
      <p className="hint">To change the letter, edit the file. This page reads it from disk each time.</p>

      {brief.length > 0 && (
        <details className="brief">
          <summary>How this letter was planned</summary>
          <dl>
            {brief.map((b) => (
              <div key={b.label}>
                <dt>{b.label}</dt>
                <dd>{b.body}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </div>
  );
}
