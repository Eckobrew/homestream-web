'use client';
import { useEffect, useRef, type RefObject, type MutableRefObject, type Dispatch, type SetStateAction } from 'react';
import Hls from 'hls.js';
type Setter<T> = Dispatch<SetStateAction<T>>;
export function useMediaDelivery({url,contentType,itemId,resumeSeconds,videoRef,hlsRef,setIsLoadingStream,setIsPlaying,setCurrentTime,onError,revision}: {
 revision:unknown;url:string;contentType:string;itemId:string|undefined;resumeSeconds:number;videoRef:RefObject<HTMLVideoElement|null>;hlsRef:MutableRefObject<Hls|null>;setIsLoadingStream:Setter<boolean>;setIsPlaying:Setter<boolean>;setCurrentTime:Setter<number>;onError:()=>void;
}) {
 const error = useRef(onError); error.current=onError;
 useEffect(()=>{
   const video=videoRef.current;if(!url||!video)return;
   let disposed=false;let started=false;let failed=false;
   const ready=()=>{
     if(disposed||started||failed)return;started=true;
     const position=Math.max(0,resumeSeconds);
     if(position>0 && video.currentTime < position){video.currentTime=position;setCurrentTime(position);}
     setIsLoadingStream(false);
     void video.play().then(()=>{if(!disposed)setIsPlaying(true);}).catch(()=>{if(!disposed)setIsPlaying(false);});
   };
   const hls=/mpegurl/i.test(contentType)||url.includes('.m3u8');
   video.addEventListener('canplay',ready);
   if(hls&&Hls.isSupported()){
     const player=new Hls({enableWorker:true,backBufferLength:90,startPosition:Math.max(0,resumeSeconds)});hlsRef.current=player;
     let mediaRetried = false;
     player.on(Hls.Events.ERROR, (_event, data) => {
       if (disposed || failed || !data.fatal) return;
       if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !mediaRetried) {
         mediaRetried = true;
         player.recoverMediaError();
       } else {
         failed = true;
         player.stopLoad();
         error.current();
       }
     });
     player.loadSource(url);player.attachMedia(video);
   }else{video.src=url;video.load();}
   return()=>{
     disposed=true;video.removeEventListener('canplay',ready);video.pause();
     hlsRef.current?.destroy();hlsRef.current=null;video.removeAttribute('src');video.load();
   };
 },[url,contentType,itemId,resumeSeconds,revision,videoRef,hlsRef,setIsLoadingStream,setIsPlaying,setCurrentTime]);
}
