import React, { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "./ui/button";
import { Eraser, Check } from "lucide-react";

export default function SignaturePad({ initial = "", onSave }) {
  const ref = useRef(null);
  const [saved, setSaved] = useState(initial);

  const clear = () => { ref.current?.clear(); };
  const save = () => {
    if (!ref.current || ref.current.isEmpty()) return;
    const dataUrl = ref.current.getTrimmedCanvas().toDataURL("image/png");
    setSaved(dataUrl);
    onSave?.(dataUrl);
  };

  if (saved) {
    return (
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wider text-slate-500">Müşteri İmzası</div>
        <div className="border border-slate-200 bg-white rounded-md p-3 inline-block">
          <img src={saved} alt="imza" className="max-h-24" />
        </div>
        <div>
          <Button variant="outline" size="sm" onClick={() => { setSaved(""); onSave?.(""); }}>
            <Eraser className="h-3.5 w-3.5 mr-1" /> Yeniden İmzala
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wider text-slate-500">Müşteri İmzası (parmak veya mouse ile çizin)</div>
      <div className="border-2 border-dashed border-slate-300 rounded-md bg-slate-50 inline-block">
        <SignatureCanvas
          ref={ref}
          penColor="#0F172A"
          canvasProps={{ width: 500, height: 160, className: "block max-w-full", "data-testid": "signature-canvas" }}
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={clear}><Eraser className="h-3.5 w-3.5 mr-1" />Temizle</Button>
        <Button size="sm" onClick={save} className="bg-slate-900 hover:bg-slate-800" data-testid="signature-save">
          <Check className="h-3.5 w-3.5 mr-1" />İmzayı Kaydet
        </Button>
      </div>
    </div>
  );
}
