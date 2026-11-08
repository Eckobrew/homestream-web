/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import { useEffect, type RefObject, type MutableRefObject, type Dispatch, type SetStateAction } from 'react';
type Setter<T> = Dispatch<SetStateAction<T>>;
export function useCastSession({videoRef, loadCastMedia, setIsCastConnecting, setIsCasting, setIsCastAvailable, setCastDeviceName, lastCastedUrlRef, lastCastedKeyRef, isCasting, isScrubbing, setCurrentTime, castCompatibilityRef, castLoadRef, castFinishedItem, autoplayEpisodes, nextEpisodeHandler, setIsPlaying}: {
 videoRef:RefObject<HTMLVideoElement|null>; loadCastMedia:()=>Promise<void>; setIsCastConnecting:Setter<boolean>; setIsCasting:Setter<boolean>; setIsCastAvailable:Setter<boolean>; setCastDeviceName:Setter<string>; lastCastedUrlRef:MutableRefObject<string>; lastCastedKeyRef:MutableRefObject<string>; isCasting:boolean; isScrubbing:boolean; setCurrentTime:Setter<number>; castCompatibilityRef:MutableRefObject<boolean>; castLoadRef:MutableRefObject<(compatible?:boolean)=>Promise<void>>; castFinishedItem:MutableRefObject<string>; autoplayEpisodes:boolean; nextEpisodeHandler:MutableRefObject<()=>void>; setIsPlaying:Setter<boolean>;
}) {
  // Initialize Google Cast SDK & HTMLMediaElement Remote Playback
  useEffect(() => {
    let disposed = false;
    const cleanup: Array<() => void> = [];
    // 1. Check Native Remote Playback API
    const video = videoRef.current;
    if (video && 'remote' in video && (video as any).remote) {
      const remote = (video as any).remote;

      const handleConnecting = () => {
        setIsCastConnecting(true);
        setIsCasting(false);
      };
      const handleConnect = () => {
        setIsCastConnecting(false);
        setIsCasting(true);
      };
      const handleDisconnect = () => {
        setIsCastConnecting(false);
        setIsCasting(false);
      };

      remote.addEventListener('connecting', handleConnecting);
      remote.addEventListener('connect', handleConnect);
      remote.addEventListener('disconnect', handleDisconnect);
      cleanup.push(() => { remote.removeEventListener('connecting', handleConnecting); remote.removeEventListener('connect', handleConnect); remote.removeEventListener('disconnect', handleDisconnect); });

      if (remote.watchAvailability) {
        remote
          .watchAvailability((available: boolean) => {
            if (available) setIsCastAvailable(true);
          })
          .then((id: number) => {
            const cancel = () => { void remote.cancelWatchAvailability(id); };
            if (disposed) cancel(); else cleanup.push(cancel);
          })
          .catch(() => {
            if (disposed) return;
            setIsCastAvailable(true);
          });
      } else {
        setIsCastAvailable(true);
      }
    }

    // 2. Initialize Google Cast Framework
    const initCastFramework = () => {
      if (disposed) return;
      try {
        if (typeof window === 'undefined' || !(window as any).cast?.framework) return;
        const castContext = (window as any).cast.framework.CastContext.getInstance();
        const listen = (type: string, listener: (event: any) => void) => {
          castContext.addEventListener(type, listener);
          cleanup.push(() => castContext.removeEventListener(type, listener));
        };
        castContext.setOptions({
          receiverApplicationId: (window as any).chrome?.cast?.media?.DEFAULT_MEDIA_RECEIVER_APP_ID || 'CC1AD845',
          autoJoinPolicy: (window as any).chrome?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED,
        });

        const CastState = (window as any).cast.framework.CastState;
        const currentCastState = castContext.getCastState();
        if (currentCastState && currentCastState !== CastState.NO_DEVICES_AVAILABLE) {
          setIsCastAvailable(true);
        }
        if (currentCastState === CastState.CONNECTED) {
          setIsCasting(true);
          const dev = castContext.getCurrentSession()?.getCastDevice()?.friendlyName;
          if (dev) setCastDeviceName(dev);
        }

        listen(
          (window as any).cast.framework.CastContextEventType.CAST_STATE_CHANGED,
          (event: any) => {
            if (event.castState === CastState.CONNECTED) {
              setIsCasting(true);
              setIsCastConnecting(false);
            } else if (event.castState === CastState.CONNECTING) {
              setIsCastConnecting(true);
            } else {
              setIsCasting(false);
              setIsCastConnecting(false);
            }
            if (event.castState !== CastState.NO_DEVICES_AVAILABLE) {
              setIsCastAvailable(true);
            }
          }
        );

        listen(
          (window as any).cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
          (event: any) => {
            const SessionState = (window as any).cast.framework.SessionState;
            if (
              event.sessionState === SessionState.SESSION_STARTED ||
              event.sessionState === SessionState.SESSION_RESUMED
            ) {
              setIsCasting(true);
              setIsCastConnecting(false);
              const session = castContext.getCurrentSession();
              const dev = session?.getCastDevice()?.friendlyName;
              if (dev) setCastDeviceName(dev);
              loadCastMedia();
            } else if (event.sessionState === SessionState.SESSION_ENDED) {
              setIsCasting(false);
              setIsCastConnecting(false);
              setCastDeviceName('');
              lastCastedUrlRef.current = '';
              lastCastedKeyRef.current = '';
            }
          }
        );
      } catch (err) {
        console.warn('Cast framework initialization error:', err);
      }
    };

    if (typeof window !== 'undefined') {
      if ((window as any).cast?.framework) {
        initCastFramework();
      } else {
        const prevOnGCast = (window as any).__onGCastApiAvailable;
        const available = (isAvailable: boolean) => {
          if (prevOnGCast) prevOnGCast(isAvailable);
          if (isAvailable) initCastFramework();
        };
        (window as any).__onGCastApiAvailable = available;
        cleanup.push(() => { if ((window as any).__onGCastApiAvailable === available) (window as any).__onGCastApiAvailable = prevOnGCast; });
      }
    }
    return () => { disposed = true; cleanup.forEach(stop => stop()); };
  }, [loadCastMedia]);

  // Google Cast receiver position polling & playback state sync
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isCasting) {
      interval = setInterval(() => {
        if (typeof window !== 'undefined' && (window as any).cast?.framework) {
          try {
            const session = (window as any).cast.framework.CastContext.getInstance().getCurrentSession();
            const media = session?.getMediaSession();
            if (media) {
              const estimatedTime = media.getEstimatedTime();
              if (typeof estimatedTime === 'number' && !isScrubbing && estimatedTime > 0) {
                setCurrentTime(estimatedTime);
              }
              const playerState = media.playerState;
              if (playerState === 'IDLE' && media.idleReason === 'ERROR' && !castCompatibilityRef.current) {
                castCompatibilityRef.current = true;
                void castLoadRef.current(true);
              }
              if (playerState === 'IDLE' && media.idleReason === 'FINISHED') {
                const key = String(media.mediaSessionId);
                if (castFinishedItem.current !== key) {
                  castFinishedItem.current = key;
                  if (autoplayEpisodes) nextEpisodeHandler.current();
                }
              }
              if (playerState === 'PLAYING') {
                setIsPlaying(true);
              } else if (playerState === 'PAUSED') {
                setIsPlaying(false);
              }
            }
          } catch { /* Receiver may disappear while disconnecting. */ }
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCasting, isScrubbing, autoplayEpisodes]);

}
