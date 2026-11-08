'use client';
import { useCallback, useEffect, useRef } from 'react';
import { negotiatePlayback, type Delivery } from './transport';
export function usePlaybackFallback(itemId: string | undefined) {
 const generation=useRef(0);const controllers=useRef(new Set<AbortController>());
 useEffect(()=>{generation.current++;const pending=controllers.current;return()=>{generation.current++;for(const controller of pending)controller.abort();pending.clear();};},[itemId]);
 return useCallback(async(callbacks:{ready:(delivery:Delivery)=>void;failed:()=>void;finished:()=>void})=>{
   if(!itemId)return;
   const current=generation.current;const controller=new AbortController();controllers.current.add(controller);
   try{const delivery=await negotiatePlayback(itemId,()=>'',controller.signal,true);if(!controller.signal.aborted&&current===generation.current)callbacks.ready(delivery);}
   catch{if(!controller.signal.aborted&&current===generation.current)callbacks.failed();}
   finally{controllers.current.delete(controller);if(!controller.signal.aborted&&current===generation.current)callbacks.finished();}
 },[itemId]);
}
