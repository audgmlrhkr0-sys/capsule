import { DisplayPage } from './display/DisplayPage';
import { ControllerPage } from './controller/ControllerPage';

function PlaceholderPage({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="center-panel">
      <p className="eyebrow">CAPSULE CLAW</p>
      <h1>{title}</h1>
      <p>{detail}</p>
    </main>
  );
}

export function App() {
  const path = window.location.pathname;

  if (path === '/display') {
    return <DisplayPage />;
  }
  if (/^\/play\/\d{4}$/.test(path)) {
    return <ControllerPage roomCode={path.slice(-4)} />;
  }
  if (path === '/admin') {
    return (
      <PlaceholderPage
        title="관리자 화면 준비 중"
        detail="관리 기능은 이후 단계에서 제공됩니다."
      />
    );
  }
  return (
    <PlaceholderPage
      title="Capsule Claw"
      detail="/display에서 디스플레이 방을 시작하세요."
    />
  );
}
