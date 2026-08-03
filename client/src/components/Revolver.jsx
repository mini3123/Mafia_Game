/**
 * 리볼버 — 직접 그린 SVG. 외부 이미지를 안 쓰므로 아무리 키워도 안 깨지고,
 * 색을 배경에 맞춰 조절할 수 있다.
 *
 * 실린더의 약실 여섯 개는 배경색으로 뚫어 놓았다. 배경이 바뀌면 같이 바뀐다.
 */

const CHAMBER_CENTER = { x: 214, y: 104 };
const CHAMBER_ORBIT = 20;
const CHAMBERS = [0, 60, 120, 180, 240, 300].map((deg) => {
  const rad = (deg * Math.PI) / 180;
  return {
    cx: CHAMBER_CENTER.x + CHAMBER_ORBIT * Math.cos(rad),
    cy: CHAMBER_CENTER.y + CHAMBER_ORBIT * Math.sin(rad),
  };
});

export default function Revolver({ className = '', title = null }) {
  return (
    <svg
      className={`revolver ${className}`}
      viewBox="10 56 330 192"
      role={title ? 'img' : 'presentation'}
      aria-label={title ?? undefined}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      <defs>
        <linearGradient id="gunmetal" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#8991ad" />
          <stop offset="45%" stopColor="#4a5069" />
          <stop offset="100%" stopColor="#20242f" />
        </linearGradient>
      </defs>

      <g fill="url(#gunmetal)">
        {/* 가늠쇠 */}
        <rect x="26" y="79" width="9" height="11" rx="1" />
        {/* 총열 */}
        <rect x="16" y="88" width="160" height="27" rx="3" />
        {/* 총열 아래 덮개 */}
        <rect x="46" y="113" width="130" height="15" rx="3" />
        {/* 프레임 */}
        <rect x="166" y="80" width="116" height="43" rx="5" />
        {/* 실린더 */}
        <rect x="176" y="73" width="76" height="62" rx="11" />
        {/* 공이치기 */}
        <path d="M264 80 L296 64 L303 77 L285 92 Z" />
        {/* 방아쇠울 */}
        <path d="M232 122 L262 122 L262 150 Q246 178 222 168 Q208 146 232 122 Z" />
        {/* 손잡이 */}
        <path d="M258 116 L298 116 L330 224 L296 240 L256 172 Z" />
      </g>

      {/* 약실 — 배경색으로 뚫는다 */}
      <g fill="var(--night)">
        {CHAMBERS.map(({ cx, cy }) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="6.5" />
        ))}
        <circle cx={CHAMBER_CENTER.x} cy={CHAMBER_CENTER.y} r="3.5" />
      </g>

      {/* 총열 능선 — 금속에 빛이 닿은 선 */}
      <rect x="16" y="90" width="160" height="2" fill="#a8b0c9" opacity="0.5" />
    </svg>
  );
}
