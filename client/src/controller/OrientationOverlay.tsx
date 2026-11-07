export function OrientationOverlay() {
  return (
    <div className="orientation-overlay" role="dialog" aria-modal="true">
      <div className="rotate-phone" aria-hidden="true">▯</div>
      <h2>휴대폰을 가로로 돌려주세요</h2>
      <p>게임 조작은 가로 화면에서만 사용할 수 있어요.</p>
    </div>
  );
}
