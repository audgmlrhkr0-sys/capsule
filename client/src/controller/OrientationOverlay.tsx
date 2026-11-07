export function OrientationOverlay() {
  return (
    <div className="orientation-overlay" role="dialog" aria-modal="true">
      <svg className="rotate-phone" viewBox="0 0 48 48" aria-hidden="true">
        <rect x="15" y="6" width="18" height="32" rx="3.5" />
        <path d="M8 34a17 17 0 0 0 14 10M40 14A17 17 0 0 0 26 4" />
      </svg>
      <h2>휴대폰을 가로로 돌려주세요</h2>
    </div>
  );
}
