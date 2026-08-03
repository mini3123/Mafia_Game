import { useEffect, useState } from 'react';
import { PHASE_LABEL } from '../labels.js';

const secondsLeft = (endsAt) =>
  endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : null;

export default function PhaseBanner({
  phase, day, phaseEndsAt,
  onAdjust = null, myAdjust = null, canAdjust = false,
}) {
  const [remaining, setRemaining] = useState(() => secondsLeft(phaseEndsAt));

  useEffect(() => {
    setRemaining(secondsLeft(phaseEndsAt));
    if (!phaseEndsAt) return undefined;
    // 서버가 준 절대 시각에서 역산만 한다. 판정은 서버 몫이다.
    const id = setInterval(() => setRemaining(secondsLeft(phaseEndsAt)), 250);
    return () => clearInterval(id);
  }, [phaseEndsAt]);

  const showAdjust = Boolean(onAdjust) && remaining !== null;

  return (
    <header className="banner">
      <div className="banner__what">
        <p className="eyebrow">{day}일차</p>
        <h1 className="banner__phase">{PHASE_LABEL[phase] ?? phase}</h1>
      </div>

      {remaining !== null && (
        <div className="banner__time">
          <p className="banner__clock">
            <span data-testid="countdown">{remaining}</span>
            <span className="banner__unit">초</span>
          </p>

          {showAdjust && (
            <div className="banner__adjust">
              <button
                type="button"
                className="banner__step"
                disabled={!canAdjust}
                aria-pressed={myAdjust === 'SHORTEN'}
                title="시간을 20초 줄입니다"
                onClick={() => onAdjust('SHORTEN')}
              >
                −20초
              </button>
              <button
                type="button"
                className="banner__step"
                disabled={!canAdjust}
                aria-pressed={myAdjust === 'EXTEND'}
                title="시간을 20초 늘립니다"
                onClick={() => onAdjust('EXTEND')}
              >
                +20초
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
