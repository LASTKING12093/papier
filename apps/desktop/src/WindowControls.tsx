import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { native } from "./api";
export function WindowControls({onClose,onError}:{onClose:()=>void;onError:(e:unknown)=>void}){
  const [max,setMax]=useState(false);
  useEffect(()=>{if(!native)return;const w=getCurrentWindow();const p=w.onResized(()=>{void w.isMaximized().then(setMax);});void w.isMaximized().then(setMax);return()=>{void p.then(f=>f());};},[]);
  if(!native)return null;
  return <div className="window-controls">
    <button aria-label="Minimize window" onClick={()=>void getCurrentWindow().minimize().catch(onError)}><svg width="12" height="12"><path d="M1 6.5h10"/></svg></button>
    <button aria-label={max?"Restore window":"Maximize window"} onClick={()=>void getCurrentWindow().toggleMaximize().catch(onError)}><svg width="12" height="12">{max?<path d="M3.5 3.5v-2h7v7h-2M1.5 3.5h7v7h-7z"/>:<path d="M1.5 1.5h9v9h-9z"/>}</svg></button>
    <button className="window-close" aria-label="Close window" onClick={onClose}><svg width="12" height="12"><path d="m1.5 1.5 9 9m0-9-9 9"/></svg></button>
  </div>;
}
