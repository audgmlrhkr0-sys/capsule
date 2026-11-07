import { useState, type PointerEvent } from 'react';
import { socket } from '../socket/client';

export function DropButton() {
  const [pressed, setPressed] = useState(false);

  const activate = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
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
