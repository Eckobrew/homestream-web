export interface BridgeCastDevice {
  id: string;
  name: string;
  host: string;
  port: number;
}

export interface BridgeCastStatus {
  connected: boolean;
  deviceId?: string;
  deviceName?: string;
  playerState?: 'IDLE' | 'BUFFERING' | 'PLAYING' | 'PAUSED';
  currentTime?: number;
  duration?: number;
  volume?: number;
  muted?: boolean;
  title?: string;
}

export async function fetchCastBridgeDevices(): Promise<BridgeCastDevice[]> {
  try {
    const res = await fetch('/api/cast-bridge/devices', { credentials: 'include' });
    if (!res.ok) return [];
    const data = (await res.json()) as { devices?: BridgeCastDevice[] };
    return Array.isArray(data.devices) ? data.devices : [];
  } catch {
    return [];
  }
}

export async function loadCastBridgeMedia(opts: {
  deviceId: string;
  contentUrl: string;
  contentType?: string;
  title: string;
  artworkUrl?: string;
  currentTime?: number;
}): Promise<BridgeCastStatus | null> {
  const res = await fetch('/api/cast-bridge/load', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { status?: BridgeCastStatus };
  return data.status ?? null;
}

export async function controlCastBridge(
  action: 'play' | 'pause' | 'seek' | 'volume' | 'mute' | 'stop',
  value?: number | boolean
): Promise<BridgeCastStatus | null> {
  const res = await fetch('/api/cast-bridge/control', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, value }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { status?: BridgeCastStatus };
  return data.status ?? null;
}
