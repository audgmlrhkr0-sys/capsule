import type {
  JoinResult,
  PublicGameState,
  SlotId,
  TurnPhase,
} from '@capsule-claw/shared';
import { useEffect, useRef, useState } from 'react';
import {
  clearPlayerSession,
  getPlayerNickname,
  getPlayerSession,
  savePlayerSession,
} from '../hooks/useAnonymousSession';
import { enterLandscapeFullscreen } from '../hooks/useOrientation';
import { socket } from '../socket/client';
import { LandscapeControls } from './LandscapeControls';
import { NicknameForm } from './NicknameForm';
import { CooldownView } from './CooldownView';

type ControllerState =
  | { status: 'nickname' }
  | { status: 'joined'; slot: SlotId }
  | { status: 'queued'; position: number }
  | { status: 'cooldown'; endsAt: number };

export function ControllerPage({ roomCode }: { roomCode: string }) {
  const [controller, setController] = useState<ControllerState>({ status: 'nickname' });
  const [nickname, setNickname] = useState(
    () => getPlayerNickname(roomCode) ?? '',
  );
  const [error, setError] = useState<string | null>(null);
  const [turnEndsAt, setTurnEndsAt] = useState<number | null>(null);
  const [turnDuration, setTurnDuration] = useState(30_000);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [phase, setPhase] = useState<TurnPhase>('waiting');
  const [turnResult, setTurnResult] = useState<{
    success: boolean;
    prizeName?: string;
  } | null>(null);
  const pendingNickname = useRef<string | null>(null);
  const slotRef = useRef<SlotId | null>(null);
  const nicknameRef = useRef(nickname);

  const applyResult = (result: JoinResult) => {
    savePlayerSession(roomCode, result.sessionToken, nicknameRef.current);
    if (result.status === 'joined') {
      slotRef.current = result.slot;
      setController({ status: 'joined', slot: result.slot });
    } else if (result.status === 'queued') {
      slotRef.current = null;
      setController({ status: 'queued', position: result.position });
    } else {
      slotRef.current = null;
      setController({ status: 'cooldown', endsAt: result.endsAt });
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
      const stored = getPlayerNickname(roomCode);
      const name = pending ?? stored;
      if (name && (pending !== null || getPlayerSession(roomCode))) {
        nicknameRef.current = name;
        setNickname(name);
        emitJoin(name);
        pendingNickname.current = null;
      }
    };
    const onJoined = ({ slot, sessionToken }: { slot: SlotId; sessionToken: string }) => {
      savePlayerSession(roomCode, sessionToken, nicknameRef.current);
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
      savePlayerSession(roomCode, sessionToken, nicknameRef.current);
      slotRef.current = null;
      setController({ status: 'queued', position });
    };
    const onQueueUpdate = ({ position }: { position: number }) => {
      setController({ status: 'queued', position });
    };
    const onTurnStart = ({ timeLimit, endsAt }: { timeLimit: number; endsAt: number }) => {
      setTurnEndsAt(endsAt);
      setTurnDuration(timeLimit);
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
    const onCooldown = ({ endsAt }: { endsAt: number }) => {
      slotRef.current = null;
      setTurnEndsAt(null);
      setTurnResult(null);
      setController({ status: 'cooldown', endsAt });
    };
    const onKicked = ({ reason }: { reason: string }) => {
      clearPlayerSession(roomCode);
      slotRef.current = null;
      setController({ status: 'nickname' });
      setError(reason);
    };
    const sendActivity = () => {
      if (socket.connected && getPlayerSession(roomCode)) {
        socket.emit('activity');
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') sendActivity();
    };

    socket.on('connect', onConnect);
    socket.on('joined', onJoined);
    socket.on('queued', onQueued);
    socket.on('queue:update', onQueueUpdate);
    socket.on('turn:start', onTurnStart);
    socket.on('state:update', onStateUpdate);
    socket.on('turn:result', onTurnResult);
    socket.on('cooldown', onCooldown);
    socket.on('kicked', onKicked);
    const activityTimer = window.setInterval(sendActivity, 20_000);
    window.addEventListener('focus', sendActivity);
    document.addEventListener('visibilitychange', onVisibility);
    socket.connect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('joined', onJoined);
      socket.off('queued', onQueued);
      socket.off('queue:update', onQueueUpdate);
      socket.off('turn:start', onTurnStart);
      socket.off('state:update', onStateUpdate);
      socket.off('turn:result', onTurnResult);
      socket.off('cooldown', onCooldown);
      socket.off('kicked', onKicked);
      window.clearInterval(activityTimer);
      window.removeEventListener('focus', sendActivity);
      document.removeEventListener('visibilitychange', onVisibility);
      socket.disconnect();
    };
  }, [roomCode]);

  const join = (name: string) => {
    setNickname(name);
    nicknameRef.current = name;
    setError(null);
    void enterLandscapeFullscreen();
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
        slot={controller.slot}
        endsAt={turnEndsAt}
        turnDuration={turnDuration}
        serverTimeOffset={serverTimeOffset}
        phase={phase}
        result={turnResult}
      />
    );
  }

  if (controller.status === 'cooldown') {
    return (
      <CooldownView
        endsAt={controller.endsAt}
        serverTimeOffset={serverTimeOffset}
        onRejoin={() => join(nicknameRef.current)}
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

  return <NicknameForm error={error} onJoin={join} />;
}
