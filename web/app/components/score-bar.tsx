// The score is out of 100. Ticks mark 0, 50, 75 and 100; 75 is the strong-fit line.
export function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="score-bar">
      <div className="track" role="img" aria-label={`Score ${score.toFixed(1)} out of 100`}>
        <div className="fill" style={{ width: `${pct}%` }} />
        <div className="mark75" />
      </div>
      <div className="ticks" aria-hidden="true">
        <span>0</span><span>50</span><span>75</span><span>100</span>
      </div>
    </div>
  );
}

export function MiniScore({ score }: { score: number }) {
  return (
    <span className="mini-score">
      <span className="num">{score.toFixed(1)}</span>
      <span className="mini-track" aria-hidden="true">
        <span style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </span>
    </span>
  );
}
