import type { Direction } from '@capsule-claw/shared';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { socket } from '../socket/client';

const DIRECTIONS: Array<{ direction: Direction; symbol: string }> = [
  { direction: 'up', symbol: '↑' },
  { direction: 'left', symbol: '←' },
  { direction: 'right', symbol: '→' },
  { direction: 'down', symbol: '↓' },
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
    <div className="dpad" aria-label="Claw direction controls">
      {DIRECTIONS.map(({ direction, symbol }) => (
        <button
          type="button"
          className={`dpad-${direction}`}
          data-active={active.has(direction)}
          aria-label={`Move ${direction}`}
          disabled={disabled}
          key={direction}
          onPointerDown={(event) => press(direction, event)}
          onPointerUp={(event) => release(direction, event)}
          onPointerCancel={(event) => release(direction, event)}
          onLostPointerCapture={(event) => release(direction, event)}
        >
          {symbol}
        </button>
      ))}
      <span className="dpad-center" />
    </div>
  );
}
