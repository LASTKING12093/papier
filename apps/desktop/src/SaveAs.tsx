import { useState } from "react";
import { Dialog,Field,Select } from "./components";
import type { Session } from "../../../packages/editor-state/types";
import { api,download,saveDocument,native } from "./api";
export function SaveAs({doc,page,onClose,onSaved}:{doc:Session;page:number;onClose:()=>void;onSaved:(s:Session|null)=>void}){
  const [name,setName]=useState(doc.name.replace(/\.pdf$/i,"")),[format,setFormat]=useState("PDF document (.pdf)"),[optimize,setOptimize]=useState(false),[flatten,setFlatten]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const pdf=format.startsWith("PDF");
  return <Dialog title="Save as" onClose={onClose}><form className="save-as" onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");let copy:Session|null=null;try{
    if(pdf){let source=doc;if(optimize||flatten){copy=await api<Session>("import",undefined,{data:await api<string>("export",doc.id),name:`${name}.pdf`});source=copy;if(flatten)source=await api<Session>("edit",source.id,{revision:source.revision,command:{kind:"flatten_forms"}});if(optimize)source=await api<Session>("optimize",source.id);}
      const saved=await saveDocument({...source,name:`${name}.pdf`},"as");if(native&&!saved)return;onSaved(copy?null:saved);
    }else if(format.startsWith("Plain"))await download(await api<string>("export_text",doc.id),`${name}.txt`,"text/plain",false);
    else{const image=await api<string>("render",doc.id,{page,width:Math.min(4096,Math.round(doc.info.pages[page].width*2))});await download(image.split(",")[1],`${name}-page-${page+1}.png`,"image/png");}
    onClose();
  }catch(e){setError(String(e));}finally{if(copy)await api("close",copy.id,{discard:true});setBusy(false);}}}>
    <div className="dialog-body"><div className="save-as-fields"><Field label="Filename"><input autoFocus required value={name} maxLength={180} onChange={e=>setName(e.target.value.replace(/[<>:"/\\|?*]/g,""))}/></Field><Field label="Format"><Select label="Save format" value={format} onChange={setFormat} options={["PDF document (.pdf)","PNG image (.png)","Plain text (.txt)"]}/></Field></div>
      {pdf?<><label className="check-row"><input type="checkbox" checked={optimize} onChange={e=>setOptimize(e.target.checked)}/>Optimize PDF streams</label><label className="check-row"><input type="checkbox" checked={flatten} onChange={e=>setFlatten(e.target.checked)}/>Flatten form fields in saved copy</label><p className="save-description">{flatten?"Form fields become page content in this copy. They will no longer be fillable.":"Preserves editable text, images and document structure."}</p></>:<p className="save-description">{format.startsWith("PNG")?`Exports page ${page+1} at 144 dpi. The PDF stays editable.`:"Exports extracted document text. Page formatting is not retained."}</p>}
      <p className="save-location">{native?"The next dialog chooses where to save the file.":"The file will be saved through your browser."}</p>{error&&<p role="alert" className="new-document-error">{error}</p>}
    </div><footer><button type="button" className="secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy?"Saving…":"Save"}</button></footer>
  </form></Dialog>;
}
