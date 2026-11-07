import {
  canEnterFullscreen,
  enterLandscapeFullscreen,
  useFullscreen,
} from '../hooks/useOrientation';

export function OrientationOverlay() {
  const fullscreen = useFullscreen();
  const showButton = canEnterFullscreen() && !fullscreen;

  return (
    <div className="orientation-overlay" role="dialog" aria-modal="true">
      {showButton ? (
        <button
          type="button"
          className="fullscreen-button"
          onClick={() => void enterLandscapeFullscreen()}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
          <span>전체화면</span>
        </button>
      ) : (
        <>
          <svg className="rotate-phone" viewBox="0 0 48 48" aria-hidden="true">
            <rect x="15" y="6" width="18" height="32" rx="3.5" />
            <path d="M8 34a17 17 0 0 0 14 10M40 14A17 17 0 0 0 26 4" />
          </svg>
          <h2>휴대폰을 가로로 돌려주세요</h2>
        </>
      )}
    </div>
  );
}
