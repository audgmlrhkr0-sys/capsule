import { useEffect, useState, type PointerEvent } from 'react';
import { socket } from '../socket/client';

export function DropButton({ disabled = false }: { disabled?: boolean }) {
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (disabled) setPressed(false);
  }, [disabled]);

  const activate = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!pressed) {
      setPressed(true);
      socket.emit('drop');
    }
  };

  const release = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setPressed(false);
  };

  return (
    <button
      type="button"
      className="drop-button"
      data-active={pressed}
      aria-label="Drop claw"
      disabled={disabled}
      onPointerDown={activate}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <span>DROP</span>
      <small>집게 내리기</small>
    </button>
  );
}
