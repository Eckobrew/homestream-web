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
   let disposed=false;let resumed=false;let started=false;
   const ready=()=>{
     if(disposed||started)return;started=true;
     if(!resumed){resumed=true;const position=Math.max(0,resumeSeconds);if(position>0){video.currentTime=position;setCurrentTime(position);}}
     setIsLoadingStream(false);
     void video.play().then(()=>{if(!disposed)setIsPlaying(true);}).catch(()=>{if(!disposed)setIsPlaying(false);});
   };
   const hls=/mpegurl/i.test(contentType)||url.includes('.m3u8');
   video.addEventListener('canplay',ready);
   if(hls&&Hls.isSupported()){
     const player=new Hls({enableWorker:true,backBufferLength:90,startPosition:resumeSeconds||-1});hlsRef.current=player;
     player.loadSource(url);player.attachMedia(video);
     player.on(Hls.Events.ERROR,(_event,data)=>{if(disposed||!data.fatal)return;if(data.type===Hls.ErrorTypes.NETWORK_ERROR)player.startLoad();else if(data.type===Hls.ErrorTypes.MEDIA_ERROR)player.recoverMediaError();else error.current();});
   }else{video.src=url;video.load();}
   return()=>{
     disposed=true;video.removeEventListener('canplay',ready);video.pause();
     hlsRef.current?.destroy();hlsRef.current=null;video.removeAttribute('src');video.load();
   };
 },[url,contentType,itemId,resumeSeconds,revision,videoRef,hlsRef,setIsLoadingStream,setIsPlaying,setCurrentTime]);
}
