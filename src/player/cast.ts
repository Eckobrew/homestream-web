/** Cast SDK interaction is kept behind this narrow adapter for testable subtitle selection. */
export function selectCastSubtitles(sdk: { createRequest(ids: number[]): unknown; editTracks(request: unknown, success: () => void, failure: () => void): void }, index: number) {
  sdk.editTracks(sdk.createRequest(index < 0 ? [] : [index + 1]), () => {}, () => {});
}

export const CAST_NAMESPACE = 'urn:x-cast:uk.eckonet.homestream';
const DEFAULT_RECEIVER_ID = '75369D0A';

export function castReceiverId() {
  const configured = process.env.NEXT_PUBLIC_CAST_RECEIVER_APP_ID;
  return configured && /^[a-f\d]{8}$/i.test(configured) ? configured.toUpperCase() : DEFAULT_RECEIVER_ID;
}

type CapabilitySession = {
  addMessageListener(namespace: string, listener: (namespace: string, message: string) => void): void;
  removeMessageListener(namespace: string, listener: (namespace: string, message: string) => void): void;
  sendMessage(namespace: string, message: object): Promise<unknown>;
};

export function requestCastCapabilities(session: CapabilitySession): Promise<string | undefined> {
  return new Promise(resolve => {
    const requestId = crypto.randomUUID();
    const finish = (video?: string) => {
      clearTimeout(timer);
      try { session.removeMessageListener(CAST_NAMESPACE, receive); } catch { /* Session already ended. */ }
      resolve(video);
    };
    function receive(_namespace: string, message: string) {
      try {
        const data = JSON.parse(message);
        if (data.type === 'capabilities' && data.requestId === requestId && Array.isArray(data.video)) {
          finish(data.video.length <= 5 ? JSON.stringify(data.video) : undefined);
        }
      } catch { /* Ignore unrelated receiver messages. */ }
    }
    const timer = setTimeout(finish, 1200);
    try {
      session.addMessageListener(CAST_NAMESPACE, receive);
      void session.sendMessage(CAST_NAMESPACE, { type: 'capabilities-request', requestId }).catch(() => finish());
    } catch {
      finish();
    }
  });
}


export function castStartupState(pending: { attempt: number; deadline: number }, media: unknown, now = Date.now()) {
  const status = media as { media?: { customData?: { attempt?: number } }; playerState?: string; idleReason?: string } | null;
  const matches = status?.media?.customData?.attempt === pending.attempt;
  if (matches && (status.playerState === 'PLAYING' || status.playerState === 'PAUSED')) return 'ready';
  if (now >= pending.deadline || (matches && status.playerState === 'IDLE' && status.idleReason === 'ERROR')) return 'failed';
  return 'pending';
}
