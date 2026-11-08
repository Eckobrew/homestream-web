'use client';
import React,{useState,useEffect,useRef} from 'react';
import type {MusicTrack} from '@/types';
import {SkipBack,SkipForward,X,Music2} from 'lucide-react';
export function MusicPlayer({tracks,startIndex,onClose}:{tracks:MusicTrack[];startIndex:number;onClose:()=>void}) {
 const [index,setIndex]=useState(startIndex);const [error,setError]=useState('');const audio=useRef<HTMLAudioElement>(null);
 useEffect(()=>{setIndex(startIndex);setError('');},[tracks,startIndex]);
 useEffect(()=>()=>{audio.current?.pause();},[]);
 const track=tracks[index];if(!track)return null;
 return <aside className="fixed bottom-[70px] md:bottom-0 inset-x-0 z-50 border-t border-neutral-700 bg-neutral-950/95 backdrop-blur-lg p-3 md:px-12" aria-label="Music player"><div className="flex items-center flex-wrap gap-3"><Music2 className="text-red-400 shrink-0"/><div className="min-w-0 flex-1"><p className="font-semibold truncate">{track.title}</p><p className="text-xs text-neutral-400 truncate">{track.artist} · {track.album}</p></div><button aria-label="Previous track" disabled={index===0} onClick={()=>{setIndex(i=>i-1);setError('');}} className="disabled:opacity-30"><SkipBack size={19}/></button><audio key={track.id} ref={audio} controls autoPlay preload="metadata" src={track.streamUrl} onEnded={()=>{if(index+1<tracks.length)setIndex(i=>i+1);}} onError={()=>setError('This track could not be played. Try again or choose another track.')} className="h-9 w-full sm:w-72"/><button aria-label="Next track" disabled={index>=tracks.length-1} onClick={()=>{setIndex(i=>i+1);setError('');}} className="disabled:opacity-30"><SkipForward size={19}/></button><button aria-label="Close music player" onClick={()=>{audio.current?.pause();onClose();}}><X size={20}/></button></div>{error && <p role="alert" className="text-sm text-red-300 mt-2">{error}</p>}</aside>;
}
