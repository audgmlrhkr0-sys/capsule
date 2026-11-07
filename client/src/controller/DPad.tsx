import type { Direction } from '@capsule-claw/shared';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { socket } from '../socket/client';

const DIRECTIONS: Array<{ direction: Direction; label: string }> = [
  { direction: 'up', label: '안쪽으로' },
  { direction: 'left', label: '왼쪽으로' },
  { direction: 'right', label: '오른쪽으로' },
  { direction: 'down', label: '바깥쪽으로' },
];

export function DPad({ disabled = false }: { disabled?: boolean }) {
  const activeRef = useRef(new Set<Direction>());
  const [active, setActive] = useState<Set<Direction>>(() => new Set());

  useEffect(
    () => () => {
      for (const direction of activeRef.current) {
        socket.emit('move', { direction, pressed: false });
      }
      activeRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    if (disabled) {
      for (const direction of activeRef.current) {
        socket.emit('move', { direction, pressed: false });
      }
      activeRef.current.clear();
      setActive(new Set());
    }
  }, [disabled]);

  useEffect(() => {
    const clearPressed = () => {
      for (const direction of activeRef.current) {
        socket.emit('move', { direction, pressed: false });
      }
      activeRef.current.clear();
      setActive(new Set());
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') clearPressed();
    };
    window.addEventListener('blur', clearPressed);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', clearPressed);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const press = (direction: Direction, event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!activeRef.current.has(direction)) {
      activeRef.current.add(direction);
      setActive(new Set(activeRef.current));
      socket.emit('move', { direction, pressed: true });
    }
  };

  const release = (direction: Direction, event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (activeRef.current.delete(direction)) {
      setActive(new Set(activeRef.current));
      socket.emit('move', { direction, pressed: false });
    }
  };

  return (
    <div className="dpad" aria-label="집게 방향">
      {DIRECTIONS.map(({ direction, label }) => (
        <button
          type="button"
          className={`dpad-${direction}`}
          data-active={active.has(direction)}
          aria-label={label}
          disabled={disabled}
          key={direction}
          onPointerDown={(event) => press(direction, event)}
          onPointerUp={(event) => release(direction, event)}
          onPointerCancel={(event) => release(direction, event)}
          onLostPointerCapture={(event) => release(direction, event)}
        >
          <span className="dpad-arrow" aria-hidden="true" />
        </button>
      ))}
      <span className="dpad-center" />
    </div>
  );
}
