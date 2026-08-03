import { useEffect, useState } from 'react';
import { PHASE_LABEL } from '../labels.js';

const secondsLeft = (endsAt) =>
  endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : null;

export default function PhaseBanner({ phase, day, phaseEndsAt }) {
  const [remaining, setRemaining] = useState(() => secondsLeft(phaseEndsAt));

  useEffect(() => {
    setRemaining(secondsLeft(phaseEndsAt));
    if (!phaseEndsAt) return undefined;
    // 서버가 준 절대 시각에서 역산만 한다. 판정은 서버 몫이다.
    const id = setInterval(() => setRemaining(secondsLeft(phaseEndsAt)), 250);
    return () => clearInterval(id);
  }, [phaseEndsAt]);

  return (
    <header className="banner">
      <div>
        <p className="eyebrow">{day}일차</p>
        <h1 className="banner__phase">{PHASE_LABEL[phase] ?? phase}</h1>
      </div>

      {remaining !== null && (
        <p className="banner__clock">
          <span data-testid="countdown">{remaining}</span>
          <span className="banner__unit">초</span>
        </p>
      )}
    </header>
  );
}
