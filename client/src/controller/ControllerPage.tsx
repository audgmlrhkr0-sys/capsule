import type {
  JoinResult,
  PublicGameState,
  SlotId,
  TurnPhase,
} from '@capsule-claw/shared';
import { useEffect, useRef, useState } from 'react';
import {
  getPlayerSession,
  savePlayerSession,
} from '../hooks/useAnonymousSession';
import { requestLandscape } from '../hooks/useOrientation';
import { socket } from '../socket/client';
import { LandscapeControls } from './LandscapeControls';
import { NicknameForm } from './NicknameForm';

type ControllerState =
  | { status: 'nickname' }
  | { status: 'joined'; slot: SlotId }
  | { status: 'queued'; position: number };

export function ControllerPage({ roomCode }: { roomCode: string }) {
  const [controller, setController] = useState<ControllerState>({ status: 'nickname' });
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [turnEndsAt, setTurnEndsAt] = useState<number | null>(null);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [phase, setPhase] = useState<TurnPhase>('waiting');
  const [turnResult, setTurnResult] = useState<{
    success: boolean;
    prizeName?: string;
  } | null>(null);
  const pendingNickname = useRef<string | null>(null);
  const slotRef = useRef<SlotId | null>(null);

  const applyResult = (result: JoinResult) => {
    savePlayerSession(roomCode, result.sessionToken);
    if (result.status === 'joined') {
      slotRef.current = result.slot;
      setController({ status: 'joined', slot: result.slot });
    } else {
      setController({ status: 'queued', position: result.position });
    }
  };

  const emitJoin = (name: string) => {
    socket.emit(
      'join',
      {
        roomCode,
        nickname: name,
        sessionToken: getPlayerSession(roomCode),
      },
      (result) => {
        if (!result.ok) {
          setController({ status: 'nickname' });
          setError(result.error);
          return;
        }
        applyResult(result.data);
      },
    );
  };

  useEffect(() => {
    const onConnect = () => {
      const pending = pendingNickname.current;
      if (pending) {
        emitJoin(pending);
        pendingNickname.current = null;
      }
    };
    const onJoined = ({ slot, sessionToken }: { slot: SlotId; sessionToken: string }) => {
      savePlayerSession(roomCode, sessionToken);
      slotRef.current = slot;
      setController({ status: 'joined', slot });
    };
    const onQueued = ({
      position,
      sessionToken,
    }: {
      position: number;
      sessionToken: string;
    }) => {
      savePlayerSession(roomCode, sessionToken);
      setController({ status: 'queued', position });
    };
    const onQueueUpdate = ({ position }: { position: number }) => {
      setController({ status: 'queued', position });
    };
    const onTurnStart = ({ endsAt }: { timeLimit: number; endsAt: number }) => {
      setTurnEndsAt(endsAt);
      setTurnResult(null);
      setPhase('aiming');
    };
    const onStateUpdate = (state: PublicGameState) => {
      setServerTimeOffset(state.serverTime - Date.now());
      const slot = slotRef.current;
      if (slot !== null) {
        const nextPhase = state.claws[slot]?.phase ?? 'waiting';
        setPhase(nextPhase);
        if (nextPhase === 'waiting') {
          setTurnResult(null);
        }
      }
    };
    const onTurnResult = (result: { success: boolean; prizeName?: string }) => {
      setTurnEndsAt(null);
      setTurnResult(result);
      setPhase('result');
    };

    socket.on('connect', onConnect);
    socket.on('joined', onJoined);
    socket.on('queued', onQueued);
    socket.on('queue:update', onQueueUpdate);
    socket.on('turn:start', onTurnStart);
    socket.on('state:update', onStateUpdate);
    socket.on('turn:result', onTurnResult);
    socket.connect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('joined', onJoined);
      socket.off('queued', onQueued);
      socket.off('queue:update', onQueueUpdate);
      socket.off('turn:start', onTurnStart);
      socket.off('state:update', onStateUpdate);
      socket.off('turn:result', onTurnResult);
      socket.disconnect();
    };
  }, [roomCode]);

  const join = (name: string) => {
    setNickname(name);
    setError(null);
    void requestLandscape();
    if (socket.connected) {
      emitJoin(name);
    } else {
      pendingNickname.current = name;
      socket.connect();
    }
  };

  if (controller.status === 'joined') {
    return (
      <LandscapeControls
        roomCode={roomCode}
        nickname={nickname}
        slot={controller.slot}
        endsAt={turnEndsAt}
        serverTimeOffset={serverTimeOffset}
        phase={phase}
        result={turnResult}
      />
    );
  }

  if (controller.status === 'queued') {
    return (
      <main className="queue-page">
        <section className="queue-card">
          <p className="controller-kicker">ROOM {roomCode}</p>
          <span className="queue-number">{controller.position}</span>
          <h1>대기 중이에요</h1>
          <p>세 개의 집게가 모두 사용 중입니다.<br />현재 대기 순서를 유지해주세요.</p>
        </section>
      </main>
    );
  }

  return <NicknameForm roomCode={roomCode} error={error} onJoin={join} />;
}
