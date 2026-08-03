/**
 * 조준경 과녁 — 마피아의 아 자에 들어있는 동그라미 위에 겹친다.
 * 링은 글자 테두리와 같은 색으로 포개어 하나처럼 보이게 하고,
 * 십자선만 글자 밖으로 뻗어나가 과녁이라는 걸 드러낸다.
 */
export default function Scope({ className = '' }) {
  return (
    <svg
      className={`scope ${className}`}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        {/* 글자의 동그라미에 포개지는 링 */}
        <circle cx="50" cy="50" r="34" strokeWidth="4" opacity="0.9" />

        {/* 십자선 — 글자 밖으로 뻗는다 */}
        <g strokeWidth="4">
          <line x1="50" y1="2" x2="50" y2="26" />
          <line x1="50" y1="74" x2="50" y2="98" />
          <line x1="2" y1="50" x2="26" y2="50" />
          <line x1="74" y1="50" x2="98" y2="50" />
        </g>
      </g>
      <circle cx="50" cy="50" r="4" fill="currentColor" />
    </svg>
  );
}
