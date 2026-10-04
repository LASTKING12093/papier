import { useEffect, useState } from "react";
import { Dialog, Select, Spinner } from "./components";
import { api, renderPage } from "./api";
import type { Session } from "../../../packages/editor-state/types";
import { ChevronLeft, ChevronRight } from "./icons";
export function Compare({before,after,onClose}:{before:Session;after:Session;onClose:()=>void}){
  const [page,setPage]=useState(0),[mode,setMode]=useState("Side by side"),[src,setSrc]=useState<string[]>([]),[text,setText]=useState<string[][]>([]),[changed,setChanged]=useState<number|null>(null),[heat,setHeat]=useState(""),[error,setError]=useState("");
  const total=Math.max(before.info.pages.length,after.info.pages.length);
  useEffect(()=>{let valid=true;Promise.all([api<string[]>("text",before.id),api<string[]>("text",after.id)]).then(v=>{if(valid)setText(v);}).catch(e=>setError(String(e)));return()=>{valid=false;};},[]);
  useEffect(()=>{let valid=true;setSrc([]);setChanged(null);setHeat("");setError("");
    Promise.all([before,after].map(d=>page<d.info.pages.length?renderPage(d,page,600):Promise.resolve(""))).then(async images=>{
      if(!valid)return;setSrc(images);
      if(images.some(v=>!v)){setChanged(100);return;}
      const bitmaps=await Promise.all(images.map(async s=>createImageBitmap(await(await fetch(s)).blob())));
      const w=Math.max(...bitmaps.map(b=>b.width)),h=Math.max(...bitmaps.map(b=>b.height));
      const surfaces=bitmaps.map(bitmap=>{const c=document.createElement("canvas");c.width=w;c.height=h;const cx=c.getContext("2d")!;cx.fillStyle="#fff";cx.fillRect(0,0,w,h);cx.drawImage(bitmap,0,0);return cx.getImageData(0,0,w,h);});
      let count=0;const output=new ImageData(w,h);
      for(let i=0;i<surfaces[0].data.length;i+=4){const delta=Math.max(...[0,1,2].map(c=>Math.abs(surfaces[0].data[i+c]-surfaces[1].data[i+c])));if(delta>24){count++;output.data.set([196,92,53,Math.min(210,delta)],i);}}
      const c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d")!.putImageData(output,0,0);if(valid){setHeat(c.toDataURL());setChanged(count/(w*h)*100);}bitmaps.forEach(b=>b.close());
    }).catch(e=>{if(valid)setError(String(e));});return()=>{valid=false;};
  },[page,before.id,before.revision,after.id,after.revision]);
  return <Dialog title="Compare PDFs" onClose={onClose} wide><div className="compare-workspace"><div className="compare-toolbar"><button aria-label="Previous comparison page" disabled={page===0} onClick={()=>setPage(page-1)}><ChevronLeft size={14}/></button><span>Page {page+1} / {total}</span><button aria-label="Next comparison page" disabled={page===total-1} onClick={()=>setPage(page+1)}><ChevronRight size={14}/></button><span className="compare-summary">{changed===null?"Comparing page…":changed===0?"No visual differences":`${changed.toFixed(2)}% of rendered pixels differ`}</span><Select label="Comparison view" value={mode} onChange={setMode} options={["Side by side","Overlay","Text"]}/></div>
    <div className="compare-names"><span>{before.name}</span><span>{after.name}</span></div>
    <div className={`comparison-content ${mode==="Overlay"?"overlay":""}`}>
      {error?<p role="alert">{error}</p>:mode==="Text"?<div className="text-diff">{[0,1].map(i=><pre key={i}>{text[i]?.[page]??"No text on this page."}</pre>)}</div>:src.length?<>{src.map((s,i)=><div key={i} className="comparison-page">{s?<img src={s} alt={i?"Compared page":"Original page"}/>:<p>Page absent</p>}{i===1&&heat&&<img className="comparison-heat" src={heat} alt="Visual difference overlay"/>}</div>)}</>:<Spinner/>}
    </div><footer><span>Visual comparison at 600 px. Text is compared separately.</span><button className="secondary" onClick={onClose}>Close</button></footer></div></Dialog>;
}
