import { useState, useRef, useCallback, useEffect, useMemo } from "react";

/*─────────────────────────────────────────────────────────────────
  CONSTANTS — EIA-310, materials, printers, connectors, devices
─────────────────────────────────────────────────────────────────*/
const EIA = { RACK_19: 482.6, RACK_10: 254, PANEL_19: 450.85, PANEL_10: 222.25, EAR_WIDTH: 15.875, UNIT_HEIGHT: 44.45, PANEL_GAP: 0.79, BORE_SPACING: [15.875, 12.7, 15.875], MOUNT_HOLE_SPACING: 465.1 };
const BASE_UNIT = 15, BASE_STRENGTH = 2, TOLERANCE = 0.2, LOCKPIN_HOLE = 4, LOCKPIN_CHAMFER = 0.8;
const LOCKPIN_WIDTH_OUTER = BASE_UNIT + BASE_STRENGTH * 2 + TOLERANCE * 2; // ~19.4mm

const PRINTERS = {
  "bambu-p2s": { name: "BambuLab P2S", bed: [256, 256, 256] },
  "bambu-a1": { name: "BambuLab A1", bed: [256, 256, 256] },
  "bambu-x1c": { name: "BambuLab X1C", bed: [256, 256, 256] },
  "prusa-mk4": { name: "Prusa MK4S", bed: [250, 210, 220] },
  "custom": { name: "Custom (300³)", bed: [300, 300, 300] },
};

const CONNECTORS = {
  "neutrik-d": { name: "Neutrik D-Type", desc: "XLR/BNC/HDMI/EtherCon/USB", cut: "d-shape", w: 24, h: 28, r: 11.9, color: "#4a90d9", icon: "◉", depthBehind: 30 },
  "bnc": { name: "BNC Bulkhead", desc: "SDI 75Ω / RF 50Ω (⌀9.5mm)", cut: "round", w: 14, h: 14, r: 4.75, color: "#d4a017", icon: "◎", depthBehind: 22 },
  "rj45-ks": { name: "RJ45 Keystone", desc: "Cat5e/6/6a (14.9×19.2)", cut: "rect", w: 16.5, h: 19.2, color: "#2d7a2e", icon: "▣", depthBehind: 28 },
  "sma": { name: "SMA Bulkhead", desc: "RF ⌀6.35mm", cut: "round", w: 10, h: 10, r: 3.175, color: "#c41e3a", icon: "●", depthBehind: 15 },
  "fiber-lc": { name: "LC Duplex Fiber", desc: "SM/MM adapter", cut: "rect", w: 26, h: 18, color: "#0056b3", icon: "⊞", depthBehind: 32 },
  "fiber-sc": { name: "SC Simplex Fiber", desc: "SM/MM adapter", cut: "rect", w: 16, h: 20, color: "#6a5acd", icon: "⊡", depthBehind: 35 },
  "usb-a": { name: "USB-A Panel", desc: "13.1×5.6mm", cut: "rect", w: 16, h: 8, color: "#555", icon: "▯", depthBehind: 25 },
  "hdmi": { name: "HDMI Feedthrough", desc: "21×9.5mm", cut: "rect", w: 24, h: 12, color: "#1a1a2e", icon: "▬", depthBehind: 30 },
  "db9": { name: "DB-9 / DE-9", desc: "Serial (17.5×9.4mm)", cut: "d-sub", w: 20, h: 12, color: "#7c3aed", icon: "⊏", depthBehind: 28 },
  "powercon": { name: "PowerCON", desc: "AC power (D-type)", cut: "d-shape", w: 24, h: 28, r: 11.9, color: "#dc2626", icon: "⚡", depthBehind: 35 },
};

const DEVICES = {
  "usw-lite-16": { name: "USW-Lite-16-PoE", w: 192, d: 185, h: 43.7, wt: 1.2, color: "#d0d0d0", ports: "16×GbE (8 PoE+)", poe: "45W" },
  "ux7": { name: "UniFi Express 7", w: 117, d: 117, h: 42.5, wt: 0.422, color: "#e8e8e8", ports: "10GbE+2.5GbE+WiFi7", poe: "—" },
  "usw-lite-8": { name: "USW-Lite-8-PoE", w: 200, d: 119, h: 30.3, wt: 0.8, color: "#ddd", ports: "8×GbE (4 PoE+)", poe: "52W" },
  "usw-pm16": { name: "USW-Pro-Max-16", w: 325.1, d: 160, h: 43.7, wt: 2.8, color: "#ccc", ports: "12×GbE+4×2.5G+2×SFP+", poe: "180W" },
  "usw-pro-24": { name: "USW-Pro-24-PoE", w: 442, d: 285, h: 44, wt: 5.1, color: "#bbb", ports: "24×GbE+2×SFP+", poe: "400W" },
  "custom": { name: "Custom Device", w: 150, d: 100, h: 30, wt: 0.5, color: "#ccc", ports: "–", poe: "–" },
};

const METALS = {
  crs16: { name: '16ga CRS 1.52mm', t: 1.52, br: 1.52, dn: 7.85 },
  crs18: { name: '18ga CRS 1.22mm', t: 1.22, br: 1.22, dn: 7.85 },
  al14: { name: '14ga Al5052 1.63mm', t: 1.63, br: 2.45, dn: 2.68 },
  al16: { name: '16ga Al5052 1.29mm', t: 1.29, br: 1.29, dn: 2.68 },
};
const FILAMENTS = {
  pla: { name: "PLA", str: "Medium", heat: "55°C" },
  petg: { name: "PETG", str: "Good", heat: "75°C" },
  abs: { name: "ABS", str: "Good", heat: "90°C" },
  asa: { name: "ASA", str: "Good", heat: "95°C" },
  pacf: { name: "PA-CF", str: "Excellent", heat: "150°C+" },
};

const pH = (u) => u * EIA.UNIT_HEIGHT - EIA.PANEL_GAP;
const uid = () => Math.random().toString(36).slice(2, 9);

/*─────────────────────────────────────────────────────────────────
  MAIN COMPONENT
─────────────────────────────────────────────────────────────────*/
export default function App() {
  // Panel
  const [std, setStd] = useState("19");
  const [uH, setUH] = useState(1);
  const [fab, setFab] = useState("3dp"); // 3dp | sm
  const [metal, setMetal] = useState("crs16");
  const [filament, setFilament] = useState("petg");
  const [prn, setPrn] = useState("bambu-p2s");
  const [wallT, setWallT] = useState(3);
  const [flangeD, setFlangeD] = useState(15);
  // Enclosure
  const [rearPanel, setRearPanel] = useState(false);
  const [ventSlots, setVentSlots] = useState(true);
  // Elements
  const [els, setEls] = useState([]);
  const [selId, setSelId] = useState(null);
  const [drag, setDrag] = useState(null);
  const [addMode, setAddMode] = useState(null);
  const [hov, setHov] = useState(null);
  const [tab, setTab] = useState("front");
  const svgRef = useRef(null);
  const sideRef = useRef(null);

  const panW = std === "19" ? EIA.PANEL_19 : EIA.PANEL_10;
  const totW = std === "19" ? EIA.RACK_19 : EIA.RACK_10;
  const panH = pH(uH);
  const mt = METALS[metal];
  const pr = PRINTERS[prn];
  const bedW = pr.bed[0];

  // Depth from deepest element
  const maxDeviceDepth = useMemo(() => {
    let d = 0;
    els.forEach(el => {
      if (el.type === "device") d = Math.max(d, DEVICES[el.key]?.d || 0);
      else d = Math.max(d, CONNECTORS[el.key]?.depthBehind || 0);
    });
    return d;
  }, [els]);
  const enclosureDepth = Math.max(50, maxDeviceDepth + (fab === "3dp" ? wallT * 2 : mt.t * 2) + 10);

  // Split logic — OpenSCAD style: 3 pieces (center + 2 side ears)
  const needsSplit = fab === "3dp" && totW > bedW;
  const splitInfo = useMemo(() => {
    if (!needsSplit) return { type: "none", parts: [{ name: "Full Panel", w: totW, fitsX: totW <= bedW, fitsY: panH <= pr.bed[1] }] };
    // OpenSCAD approach: CENTER piece (device area + flanges) + 2 SIDE EAR pieces
    // Each side ear = EAR_WIDTH + mountbar connector zone
    const mountbarW = BASE_UNIT; // 15mm connector bar
    const connectorOverlap = BASE_UNIT + BASE_STRENGTH * 2 + TOLERANCE; // ~19.4mm
    const earTotalW = EIA.EAR_WIDTH + connectorOverlap + 5; // ear + connector zone
    const centerW = totW - earTotalW * 2;

    if (centerW <= bedW && earTotalW <= bedW) {
      return {
        type: "3-piece", desc: "OpenSCAD-style: Center + 2 Side Ears",
        parts: [
          { name: "Center Panel", w: centerW, fitsX: centerW <= bedW, fitsY: panH <= pr.bed[1], color: "#f7b600" },
          { name: "Left Ear", w: earTotalW, fitsX: true, fitsY: true, color: "#22c55e" },
          { name: "Right Ear", w: earTotalW, fitsX: true, fitsY: true, color: "#22c55e" },
        ],
        joint: "lockpin", mountbarW, connectorOverlap,
        lockpinHole: LOCKPIN_HOLE, lockpinChamfer: LOCKPIN_CHAMFER,
      };
    }
    // Fallback: simple 2-piece split down center
    const halfW = totW / 2;
    return {
      type: "2-piece", desc: "Center split with dovetail + M3 bolts",
      parts: [
        { name: "Left Half", w: halfW, fitsX: halfW <= bedW, fitsY: panH <= pr.bed[1], color: "#22c55e" },
        { name: "Right Half", w: halfW, fitsX: halfW <= bedW, fitsY: panH <= pr.bed[1], color: "#4a90d9" },
      ],
      joint: "dovetail+bolt",
    };
  }, [needsSplit, totW, panH, bedW, pr.bed]);

  // Element CRUD
  const addEl = useCallback((type, key) => {
    const lib = type === "connector" ? CONNECTORS[key] : DEVICES[key];
    if (!lib) return;
    const el = { id: uid(), type, key, x: panW / 2, y: panH / 2, w: type === "device" ? lib.w : lib.w, h: type === "device" ? lib.h : lib.h, label: lib.name };
    setEls(p => [...p, el]); setSelId(el.id); setAddMode(null);
  }, [panW, panH]);
  const rmEl = useCallback(id => { setEls(p => p.filter(e => e.id !== id)); if (selId === id) setSelId(null); }, [selId]);
  const dupEl = useCallback(id => { const e = els.find(e => e.id === id); if (!e) return; const n = { ...e, id: uid(), x: Math.min(e.x + 18, panW - e.w / 2) }; setEls(p => [...p, n]); setSelId(n.id); }, [els, panW]);

  // Drag
  const onDown = (ev, id) => { ev.stopPropagation(); const svg = svgRef.current || sideRef.current; if (!svg) return; const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const sp = pt.matrixTransform(svg.getScreenCTM().inverse()); const el = els.find(e => e.id === id); if (!el) return; setDrag({ id, sx: sp.x, sy: sp.y, ox: el.x, oy: el.y }); setSelId(id); };
  const onMove = useCallback(ev => { if (!drag) return; const svg = svgRef.current || sideRef.current; if (!svg) return; const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const sp = pt.matrixTransform(svg.getScreenCTM().inverse()); const sc = 1.15; const dx = (sp.x - drag.sx) / sc, dy = (sp.y - drag.sy) / sc; setEls(p => p.map(e => e.id === drag.id ? { ...e, x: Math.max(e.w / 2, Math.min(panW - e.w / 2, drag.ox + dx)), y: Math.max(e.h / 2, Math.min(panH - e.h / 2, drag.oy + dy)) } : e)); }, [drag, panW, panH]);
  const onUp = useCallback(() => setDrag(null), []);
  useEffect(() => { if (drag) { window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp); return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); }; } }, [drag, onMove, onUp]);

  // Bores
  const bores = [];
  for (let u = 0; u < uH; u++) { const b = u * EIA.UNIT_HEIGHT; bores.push(b + 7.9375, b + 23.8125, b + 36.5125); }

  const usedW = els.reduce((s, e) => s + e.w + 4, 0);
  const remW = panW - usedW;
  const selEl = els.find(e => e.id === selId);
  const totWt = els.filter(e => e.type === "device").reduce((s, e) => s + (DEVICES[e.key]?.wt || 0), 0);

  // Sheet metal calcs
  const K = 0.40, BA90 = 1.5708 * (mt.br + K * mt.t);

  const sc = 1.15, oX = 30, oY = 40;
  const vW = totW * sc + 60, vH = panH * sc + 80;

  // Side view dimensions
  const sideVW = enclosureDepth * sc + 100;
  const sideVH = panH * sc + 80;

  const genJSON = () => JSON.stringify({
    panel: { standard: std, uHeight: uH, panelWidth: panW, panelHeight: panH, totalWidth: totW },
    enclosure: { depth: enclosureDepth, maxDeviceDepth, rearPanel, ventSlots, flangeDepth: flangeD },
    fabrication: fab === "3dp" ? { method: "3D Print", printer: pr.name, bed: pr.bed, filament: FILAMENTS[filament]?.name, wallThickness: wallT, split: splitInfo } : { method: "Sheet Metal", material: mt.name, thickness: mt.t, bendRadius: mt.br, kFactor: K, ba90: +BA90.toFixed(3), flangeDepth: flangeD },
    elements: els.map(e => ({ type: e.type, key: e.key, label: e.label, x: +e.x.toFixed(2), y: +e.y.toFixed(2), w: e.w, h: e.h, cutout: e.type === "connector" ? CONNECTORS[e.key]?.cut : "rect", radius: CONNECTORS[e.key]?.r, depthBehind: e.type === "connector" ? CONNECTORS[e.key]?.depthBehind : DEVICES[e.key]?.d })),
  }, null, 2);

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#0b0b0e", color: "#e2e2e2", fontFamily: "'JetBrains Mono','SF Mono','Fira Code',monospace" }}>
      {/* ── HEADER ── */}
      <div style={{ background: "#111116", borderBottom: "1px solid #252530", padding: "10px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: "linear-gradient(135deg,#f7b600,#d4a017)", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: "#111" }}>⊞</div>
          <div><div style={{ fontSize: 14, fontWeight: 700, letterSpacing: ".05em" }}>RACK MOUNT CONFIGURATOR</div><div style={{ fontSize: 8, color: "#555", letterSpacing: ".12em" }}>EIA-310 • 3D PRINT / SHEET METAL • FULL ENCLOSURE</div></div>
        </div>
        <div style={{ display: "flex", gap: 1 }}>
          {["front", "side", "split", "specs", "export"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ background: tab === t ? "#f7b600" : "transparent", color: tab === t ? "#111" : "#666", border: "none", padding: "4px 12px", borderRadius: 3, fontSize: 9, fontWeight: 700, letterSpacing: ".08em", cursor: "pointer", textTransform: "uppercase", fontFamily: "inherit" }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 52px)" }}>
        {/* ── SIDEBAR ── */}
        <div style={{ width: 264, minWidth: 264, background: "#111116", borderRight: "1px solid #252530", overflowY: "auto", padding: "12px 10px", fontSize: 10 }}>
          <SL>PANEL</SL>
          <R>
            <Sel l="Std" v={std} set={setStd} o={[["19",'19"'],["10",'10"']]} />
            <Sel l="U" v={uH} set={v=>setUH(+v)} o={[[1,"1U"],[2,"2U"],[3,"3U"],[4,"4U"]]} />
          </R>

          <SL>FABRICATION</SL>
          <R>
            {[["3dp","3D Print","#22c55e"],["sm","Sheet Metal","#f7b600"]].map(([v,l,c])=>(
              <button key={v} onClick={()=>setFab(v)} style={{flex:1,padding:"5px 6px",background:fab===v?c:"#1a1a22",color:fab===v?"#111":"#666",border:fab===v?"none":"1px solid #252530",borderRadius:3,fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>
            ))}
          </R>

          {fab==="3dp"?(
            <div style={{marginTop:6}}>
              <Sel l="Printer" v={prn} set={setPrn} o={Object.entries(PRINTERS).map(([k,v])=>[k,v.name])} f />
              <Sel l="Filament" v={filament} set={setFilament} o={Object.entries(FILAMENTS).map(([k,v])=>[k,`${v.name} (${v.heat})`])} f />
              <Sld l="Wall" v={wallT} set={setWallT} min={2} max={6} step={0.5} unit="mm" color="#22c55e" />
              {needsSplit && <div style={{marginTop:6,padding:"5px 7px",background:"#1a1406",border:"1px solid #f7b60033",borderRadius:3,fontSize:9,color:"#f7b600"}}>⚠ {splitInfo.type}: {splitInfo.desc}</div>}
              <div style={{fontSize:8,color:"#444",marginTop:4}}>Bed: {pr.bed.join("×")}mm</div>
            </div>
          ):(
            <div style={{marginTop:6}}>
              <Sel l="Material" v={metal} set={setMetal} o={Object.entries(METALS).map(([k,v])=>[k,v.name])} f />
            </div>
          )}

          <SL>ENCLOSURE</SL>
          <Sld l="Flange Depth" v={flangeD} set={setFlangeD} min={10} max={40} step={1} unit="mm" color="#f7b600" />
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <Chk l="Rear Panel" v={rearPanel} set={setRearPanel} />
            <Chk l="Vent Slots" v={ventSlots} set={setVentSlots} />
          </div>
          <div style={{fontSize:9,color:"#555",marginTop:4}}>
            Auto depth: <b style={{color:"#aaa"}}>{enclosureDepth.toFixed(0)}mm</b> (deepest device: {maxDeviceDepth||"—"}mm)
          </div>

          {/* Width budget */}
          <div style={{margin:"8px 0 4px"}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:8,color:"#555",marginBottom:2}}>
              <span>WIDTH</span><span style={{color:remW<0?"#ef4444":remW<30?"#f7b600":"#4ade80"}}>{remW.toFixed(0)}mm free</span>
            </div>
            <div style={{height:3,background:"#1a1a22",borderRadius:2,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${Math.min(100,(usedW/panW)*100)}%`,background:remW<0?"#ef4444":remW<30?"#f7b600":"#4ade80",borderRadius:2,transition:"width .3s"}}/>
            </div>
          </div>

          <Hr/>
          <SL>ADD ELEMENTS</SL>
          <R>
            <AB active={addMode==="con"} onClick={()=>setAddMode(addMode==="con"?null:"con")} c="#4a90d9">+ Connector</AB>
            <AB active={addMode==="dev"} onClick={()=>setAddMode(addMode==="dev"?null:"dev")} c="#22c55e">+ Device</AB>
          </R>

          {addMode==="con"&&<Pal>{Object.entries(CONNECTORS).map(([k,c])=><PI key={k} onClick={()=>addEl("connector",k)} hovered={hov===k} onMouseEnter={()=>setHov(k)} onMouseLeave={()=>setHov(null)} icon={c.icon} ic={c.color} name={c.name} desc={c.desc} meta={`${c.w}×${c.h}`}/>)}</Pal>}
          {addMode==="dev"&&<Pal>{Object.entries(DEVICES).map(([k,d])=><PI key={k} onClick={()=>addEl("device",k)} hovered={hov===k} onMouseEnter={()=>setHov(k)} onMouseLeave={()=>setHov(null)} icon="▪" ic={d.color} name={d.name} desc={`${d.w}×${d.d}×${d.h}mm`} meta={d.poe!=="–"?d.poe:""}/>)}</Pal>}

          <Hr/>
          <SL>PLACED ({els.length})</SL>
          {els.length===0&&<div style={{fontSize:9,color:"#3a3a3a",fontStyle:"italic",padding:"4px 0"}}>Add elements to begin</div>}
          {els.map(el=>{const lib=el.type==="connector"?CONNECTORS[el.key]:DEVICES[el.key];return(
            <div key={el.id} onClick={()=>setSelId(el.id)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 6px",borderRadius:3,background:selId===el.id?"#1a1a28":"transparent",border:selId===el.id?"1px solid #f7b600":"1px solid transparent",cursor:"pointer",marginBottom:1}}>
              <div style={{display:"flex",alignItems:"center",gap:4,overflow:"hidden"}}><span style={{color:lib?.color||"#888",fontSize:12}}>{lib?.icon||"▪"}</span><span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{el.label}</span></div>
              <div style={{display:"flex",gap:2}}><MB onClick={()=>dupEl(el.id)}>⧉</MB><MB onClick={e=>{e.stopPropagation();rmEl(el.id)}} d>✕</MB></div>
            </div>
          );})}

          {selEl&&<><Hr/><SL>PROPERTIES</SL><PR l="X" v={`${selEl.x.toFixed(1)}mm`}/><PR l="Y" v={`${selEl.y.toFixed(1)}mm`}/><PR l="W" v={`${selEl.w}mm`}/><PR l="H" v={`${selEl.h}mm`}/>{selEl.type==="connector"&&<PR l="Cutout" v={CONNECTORS[selEl.key]?.cut}/>}{selEl.type==="connector"&&<PR l="Behind" v={`${CONNECTORS[selEl.key]?.depthBehind}mm`}/>}{selEl.type==="device"&&<><PR l="Depth" v={`${DEVICES[selEl.key]?.d}mm`}/><PR l="Weight" v={`${DEVICES[selEl.key]?.wt}kg`}/></>}</>}
          {totWt>0&&<><Hr/><SL>LOAD</SL><PR l="Total" v={`${totWt.toFixed(2)}kg`}/><PR l="Ear-only" v={totWt<7?"✓":"⚠ Rails"}/></>}
        </div>

        {/* ── MAIN ── */}
        <div style={{flex:1,display:"flex",flexDirection:"column",background:"#0e0e12"}}>

          {/* FRONT VIEW */}
          {tab==="front"&&(
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",overflow:"auto",padding:16}}>
              <svg ref={svgRef} viewBox={`0 0 ${vW} ${vH}`} style={{maxWidth:"100%",maxHeight:"100%",filter:"drop-shadow(0 4px 20px rgba(0,0,0,.5))"}}>
                <defs><pattern id="g" width={5*sc} height={5*sc} patternUnits="userSpaceOnUse" patternTransform={`translate(${oX},${oY})`}><circle cx={5*sc} cy={5*sc} r={.3} fill="#222"/></pattern></defs>
                <rect width={vW} height={vH} fill="#0e0e12"/><rect width={vW} height={vH} fill="url(#g)"/>
                <rect x={oX} y={oY} width={totW*sc} height={panH*sc} fill="none" stroke="#333" strokeWidth={.4} strokeDasharray="4,4"/>

                {/* Split lines */}
                {needsSplit && splitInfo.type==="3-piece" && (()=>{
                  const earW=splitInfo.parts[1].w;
                  return <>{[earW, totW-earW].map((sx,i)=><line key={i} x1={oX+sx*sc} y1={oY-8} x2={oX+sx*sc} y2={oY+panH*sc+8} stroke="#22c55e" strokeWidth={1} strokeDasharray="6,3"/>)}</>;
                })()}
                {needsSplit && splitInfo.type==="2-piece" && <line x1={oX+totW/2*sc} y1={oY-8} x2={oX+totW/2*sc} y2={oY+panH*sc+8} stroke="#22c55e" strokeWidth={1} strokeDasharray="6,3"/>}

                {/* Ears */}
                {[0,1].map(s=><rect key={`e${s}`} x={oX+(s===0?0:(totW-EIA.EAR_WIDTH)*sc)} y={oY} width={EIA.EAR_WIDTH*sc} height={panH*sc} fill="#1a1a22" stroke="#444" strokeWidth={.4}/>)}
                {/* Bores */}
                {bores.map((by,i)=>[0,1].map(s=><rect key={`b${i}${s}`} x={oX+(s===0?(EIA.EAR_WIDTH/2-5)*sc:(totW-EIA.EAR_WIDTH/2-5)*sc)} y={oY+by*sc-3.25*sc} width={10*sc} height={6.5*sc} rx={3.25*sc} fill="#0e0e12" stroke="#555" strokeWidth={.35}/>))}
                {/* Panel */}
                <rect x={oX+EIA.EAR_WIDTH*sc} y={oY} width={panW*sc} height={panH*sc} fill="#1e1e26" stroke={fab==="3dp"?"#22c55e":"#f7b600"} strokeWidth={.8}/>
                {/* Center */}
                <line x1={oX+totW/2*sc} y1={oY} x2={oX+totW/2*sc} y2={oY+panH*sc} stroke="#2a2a35" strokeWidth={.3} strokeDasharray="2,4"/>

                {/* Lockpin indicators for 3-piece split */}
                {needsSplit && splitInfo.type==="3-piece" && (()=>{
                  const earW=splitInfo.parts[1].w;
                  const mbW=splitInfo.mountbarW*sc;
                  const pinY1=oY+panH*sc*0.33, pinY2=oY+panH*sc*0.67;
                  return <>{[earW, totW-earW].map((sx,i)=><g key={`lp${i}`}>
                    <rect x={oX+(sx-BASE_UNIT/2)*sc} y={oY} width={mbW} height={panH*sc} fill="#22c55e11" stroke="#22c55e" strokeWidth={.5} strokeDasharray="3,2"/>
                    <circle cx={oX+sx*sc} cy={pinY1} r={2.5} fill="none" stroke="#22c55e" strokeWidth={.8}/>
                    <circle cx={oX+sx*sc} cy={pinY2} r={2.5} fill="none" stroke="#22c55e" strokeWidth={.8}/>
                    <text x={oX+sx*sc} y={oY-12} textAnchor="middle" fill="#22c55e" fontSize={6} fontFamily="inherit">LOCKPIN</text>
                  </g>)}</>
                })()}

                {/* Elements */}
                {els.map(el=>{const lib=el.type==="connector"?CONNECTORS[el.key]:DEVICES[el.key];const ex=oX+EIA.EAR_WIDTH*sc+(el.x-el.w/2)*sc,ey=oY+(el.y-el.h/2)*sc,ew=el.w*sc,eh=el.h*sc,isSel=selId===el.id,cx=ex+ew/2,cy=ey+eh/2,isR=el.type==="connector"&&(lib?.cut==="round"||lib?.cut==="d-shape");
                  return <g key={el.id} onMouseDown={e=>onDown(e,el.id)} style={{cursor:drag?"grabbing":"grab"}}>
                    {isSel&&<rect x={ex-3} y={ey-3} width={ew+6} height={eh+6} fill="none" stroke="#f7b600" strokeWidth={1} strokeDasharray="3,2" rx={isR?(ew+6)/2:2}/>}
                    {el.type==="connector"?(isR?<circle cx={cx} cy={cy} r={(lib.r||lib.w/2)*sc} fill="#08080d" stroke={lib.color} strokeWidth={1}/>:<rect x={ex} y={ey} width={ew} height={eh} rx={1} fill="#08080d" stroke={lib?.color} strokeWidth={1}/>):<><rect x={ex} y={ey} width={ew} height={eh} rx={1.5} fill="#0d0d14" stroke={lib?.color||"#555"} strokeWidth={.6}/><line x1={ex} y1={ey} x2={ex+ew} y2={ey+eh} stroke="#222" strokeWidth={.3}/><line x1={ex+ew} y1={ey} x2={ex} y2={ey+eh} stroke="#222" strokeWidth={.3}/></>}
                    <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="central" fill={el.type==="connector"?lib?.color:"#555"} fontSize={Math.min(ew,eh)*(el.type==="connector"?.38:.1)} fontFamily="inherit">{el.type==="connector"?lib?.icon:el.label}</text>
                  </g>;
                })}

                {/* Dims */}
                <text x={oX+(EIA.EAR_WIDTH+panW/2)*sc} y={oY+panH*sc+24} textAnchor="middle" fill="#f7b600" fontSize={7} fontFamily="inherit">{panW.toFixed(1)}mm ({std}")</text>
                <text x={oX+totW*sc+20} y={oY+panH*sc/2} textAnchor="start" dominantBaseline="central" fill="#f7b600" fontSize={7} fontFamily="inherit" transform={`rotate(90 ${oX+totW*sc+20} ${oY+panH*sc/2})`}>{panH.toFixed(1)}mm ({uH}U)</text>
              </svg>
            </div>
          )}

          {/* SIDE PROFILE VIEW */}
          {tab==="side"&&(
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",overflow:"auto",padding:16}}>
              <svg ref={sideRef} viewBox={`0 0 ${sideVW} ${sideVH}`} style={{maxWidth:"100%",maxHeight:"100%",filter:"drop-shadow(0 4px 20px rgba(0,0,0,.5))"}}>
                <defs><pattern id="gs" width={5*sc} height={5*sc} patternUnits="userSpaceOnUse"><circle cx={5*sc} cy={5*sc} r={.3} fill="#222"/></pattern></defs>
                <rect width={sideVW} height={sideVH} fill="#0e0e12"/><rect width={sideVW} height={sideVH} fill="url(#gs)"/>

                {(()=>{
                  const sx=40, sy=oY;
                  const faceW = (fab==="3dp"?wallT:mt.t)*sc;
                  const depthPx = enclosureDepth*sc;
                  const hPx = panH*sc;
                  const wt = (fab==="3dp"?wallT:mt.t)*sc;

                  return <g>
                    {/* Front face */}
                    <rect x={sx} y={sy} width={faceW} height={hPx} fill="#2a2a35" stroke={fab==="3dp"?"#22c55e":"#f7b600"} strokeWidth={.8}/>
                    <text x={sx+faceW/2} y={sy-8} textAnchor="middle" fill="#888" fontSize={6} fontFamily="inherit">FRONT</text>

                    {/* Top wall */}
                    <rect x={sx} y={sy} width={depthPx} height={wt} fill="#1e1e26" stroke="#555" strokeWidth={.4}/>
                    {/* Bottom wall */}
                    <rect x={sx} y={sy+hPx-wt} width={depthPx} height={wt} fill="#1e1e26" stroke="#555" strokeWidth={.4}/>

                    {/* Flange (front retention lip) */}
                    <rect x={sx+faceW} y={sy+wt} width={flangeD*sc} height={hPx-wt*2} fill="none" stroke="#f7b60066" strokeWidth={.6} strokeDasharray="3,2"/>
                    <text x={sx+faceW+flangeD*sc/2} y={sy+hPx/2} textAnchor="middle" dominantBaseline="central" fill="#f7b60066" fontSize={5} fontFamily="inherit">FLANGE {flangeD}mm</text>

                    {/* Rear panel */}
                    {rearPanel && <rect x={sx+depthPx-wt} y={sy} width={wt} height={hPx} fill="#2a2a35" stroke="#888" strokeWidth={.5}/>}
                    <text x={sx+depthPx+6} y={sy+hPx/2} textAnchor="start" dominantBaseline="central" fill="#888" fontSize={6} fontFamily="inherit">{rearPanel?"REAR":"(open)"}</text>

                    {/* Vent slots */}
                    {ventSlots && Array.from({length:3}).map((_,i)=><rect key={`vs${i}`} x={sx+depthPx*0.4+i*12*sc} y={sy+hPx-wt} width={8*sc} height={wt} fill="#0e0e12" stroke="#555" strokeWidth={.3}/>)}

                    {/* Device outlines (side profile) */}
                    {els.filter(e=>e.type==="device").map((el,i)=>{
                      const dev=DEVICES[el.key]; if(!dev)return null;
                      const dH=dev.h*sc, dD=dev.d*sc;
                      const dY=sy+wt+(hPx-wt*2-dH)/2;
                      return <g key={el.id}>
                        <rect x={sx+faceW+2} y={dY} width={dD} height={dH} fill="#ffffff08" stroke={dev.color} strokeWidth={.6} strokeDasharray="4,2"/>
                        <text x={sx+faceW+2+dD/2} y={dY+dH/2} textAnchor="middle" dominantBaseline="central" fill="#666" fontSize={5} fontFamily="inherit">{dev.name}</text>
                        <text x={sx+faceW+2+dD/2} y={dY+dH/2+8} textAnchor="middle" fill="#444" fontSize={4} fontFamily="inherit">{dev.d}mm deep</text>
                      </g>;
                    })}

                    {/* Connector depth indicators */}
                    {els.filter(e=>e.type==="connector").slice(0,3).map((el,i)=>{
                      const con=CONNECTORS[el.key]; if(!con)return null;
                      const cD=con.depthBehind*sc;
                      const cY=sy+wt+6+i*8*sc;
                      return <line key={el.id} x1={sx+faceW} y1={cY} x2={sx+faceW+cD} y2={cY} stroke={con.color} strokeWidth={1} markerEnd="none" opacity={.5}/>;
                    })}

                    {/* Dimension line */}
                    <line x1={sx} y1={sy+hPx+16} x2={sx+depthPx} y2={sy+hPx+16} stroke="#f7b60088" strokeWidth={.4}/>
                    <text x={sx+depthPx/2} y={sy+hPx+26} textAnchor="middle" fill="#f7b600" fontSize={7} fontFamily="inherit">{enclosureDepth.toFixed(0)}mm depth</text>

                    {/* Height dim */}
                    <line x1={sx-12} y1={sy} x2={sx-12} y2={sy+hPx} stroke="#f7b60088" strokeWidth={.4}/>
                    <text x={sx-18} y={sy+hPx/2} textAnchor="middle" dominantBaseline="central" fill="#f7b600" fontSize={7} fontFamily="inherit" transform={`rotate(-90 ${sx-18} ${sy+hPx/2})`}>{panH.toFixed(1)}mm</text>
                  </g>;
                })()}
              </svg>
            </div>
          )}

          {/* SPLIT VIEW */}
          {tab==="split"&&(
            <div style={{flex:1,overflowY:"auto",padding:24,maxWidth:680}}>
              <SL>SPLIT STRATEGY — {fab==="3dp"?pr.name:"Sheet Metal"}</SL>

              {fab!=="3dp"?(<div style={{fontSize:11,color:"#888",lineHeight:1.7}}>Sheet metal panels are fabricated flat and bent — no split needed regardless of size. The flat pattern is laser-cut or CNC-punched from a single sheet.</div>):(
                <>
                  <div style={{background:"#161620",border:"1px solid #252530",borderRadius:5,padding:14,marginBottom:10}}>
                    <div style={{fontWeight:700,fontSize:12,color:needsSplit?"#f7b600":"#4ade80",marginBottom:6}}>
                      {needsSplit ? `⚠ Panel exceeds ${bedW}mm bed → ${splitInfo.type}` : `✓ Panel fits on ${pr.name} bed (${totW.toFixed(0)}mm ≤ ${bedW}mm)`}
                    </div>
                    {needsSplit && <div style={{fontSize:10,color:"#999",marginBottom:8}}>{splitInfo.desc}</div>}
                    <ST rows={splitInfo.parts.map(p=>[p.name,`${p.w.toFixed(1)}mm wide • ${p.fitsX&&p.fitsY?"✓ fits":"⚠"}`])}/>
                  </div>

                  {needsSplit && splitInfo.type==="3-piece" && (
                    <div style={{background:"#161620",border:"1px solid #252530",borderRadius:5,padding:14,marginBottom:10}}>
                      <div style={{fontWeight:700,fontSize:12,color:"#22c55e",marginBottom:6}}>OpenSCAD-Style Lockpin Joint</div>
                      <div style={{fontSize:10,color:"#999",lineHeight:1.7,marginBottom:8}}>
                        Adapted from the HomeRacker design. The center panel has <b style={{color:"#ccc"}}>mountbars</b> (15×15mm posts) extending from the rear at each split line. Each mountbar has <b style={{color:"#ccc"}}>lockpin holes</b> — chamfered 4×4mm square holes that accept printed or metal lock pins.
                        <br/><br/>
                        The side ear pieces have matching <b style={{color:"#ccc"}}>lockpin receptacles</b> — outer holes (4mm + chamfer + tolerance) that slide over the pins. The U-shaped connector on the side ear wraps around the mountbar creating a rigid mechanical interlock.
                        <br/><br/>
                        The rear support structure (tray/bracket) spans the split line, adding additional rigidity.
                      </div>
                      <ST rows={[
                        ["Mountbar", `${BASE_UNIT}×${BASE_UNIT}mm (${BASE_UNIT}mm deep)`],
                        ["Lockpin Hole", `${LOCKPIN_HOLE}×${LOCKPIN_HOLE}mm square, ${LOCKPIN_CHAMFER}mm chamfer`],
                        ["Outer Width", `${LOCKPIN_WIDTH_OUTER.toFixed(1)}mm (pin + walls + tolerance)`],
                        ["Pins per joint", "2 (spaced 15mm vertically)"],
                        ["Tolerance", `${TOLERANCE}mm`],
                        ["Assembly", "Slide ears onto center pins, friction-fit or M3 bolt through"],
                      ]}/>

                      {/* Visual diagram */}
                      <svg viewBox="0 0 300 120" style={{width:"100%",marginTop:12,background:"#0e0e12",borderRadius:4}}>
                        <text x={150} y={12} textAnchor="middle" fill="#555" fontSize={7} fontFamily="inherit">EXPLODED JOINT — TOP VIEW</text>
                        {/* Center piece */}
                        <rect x={100} y={25} width={100} height={70} fill="#1e1e26" stroke="#f7b600" strokeWidth={.8} rx={1}/>
                        <text x={150} y={55} textAnchor="middle" fill="#f7b600" fontSize={7} fontFamily="inherit">CENTER</text>
                        {/* Mountbar left */}
                        <rect x={88} y={40} width={12} height={40} fill="#22c55e33" stroke="#22c55e" strokeWidth={.8} rx={1}/>
                        <circle cx={94} cy={52} r={2} fill="none" stroke="#22c55e" strokeWidth={.8}/>
                        <circle cx={94} cy={68} r={2} fill="none" stroke="#22c55e" strokeWidth={.8}/>
                        <text x={94} y={86} textAnchor="middle" fill="#22c55e" fontSize={5}>MOUNTBAR</text>
                        {/* Mountbar right */}
                        <rect x={200} y={40} width={12} height={40} fill="#22c55e33" stroke="#22c55e" strokeWidth={.8} rx={1}/>
                        <circle cx={206} cy={52} r={2} fill="none" stroke="#22c55e" strokeWidth={.8}/>
                        <circle cx={206} cy={68} r={2} fill="none" stroke="#22c55e" strokeWidth={.8}/>
                        {/* Left ear */}
                        <rect x={30} y={25} width={50} height={70} fill="#1e1e2611" stroke="#22c55e" strokeWidth={.8} rx={1} strokeDasharray="4,2"/>
                        <text x={55} y={55} textAnchor="middle" fill="#22c55e" fontSize={7}>LEFT EAR</text>
                        {/* U-connector on ear */}
                        <path d="M 80 38 L 80 30 L 90 30 L 90 38" fill="none" stroke="#22c55e" strokeWidth={.8}/>
                        <path d="M 80 82 L 80 90 L 90 90 L 90 82" fill="none" stroke="#22c55e" strokeWidth={.8}/>
                        {/* Right ear */}
                        <rect x={220} y={25} width={50} height={70} fill="#1e1e2611" stroke="#4a90d9" strokeWidth={.8} rx={1} strokeDasharray="4,2"/>
                        <text x={245} y={55} textAnchor="middle" fill="#4a90d9" fontSize={7}>RIGHT EAR</text>
                        {/* Arrows */}
                        <text x={78} y={62} textAnchor="middle" fill="#22c55e" fontSize={10}>→</text>
                        <text x={222} y={62} textAnchor="middle" fill="#4a90d9" fontSize={10}>←</text>
                        <text x={150} y={110} textAnchor="middle" fill="#555" fontSize={6} fontFamily="inherit">Ears slide onto mountbar pins • Friction-fit or M3 bolt</text>
                      </svg>
                    </div>
                  )}

                  <div style={{background:"#161620",border:"1px solid #252530",borderRadius:5,padding:14}}>
                    <div style={{fontWeight:700,fontSize:12,color:"#f7f7f7",marginBottom:6}}>Material Considerations</div>
                    <div style={{fontSize:10,color:"#999",lineHeight:1.7}}>
                      <b style={{color:"#22c55e"}}>3D Print (FDM)</b> — Lock pins can be printed separately in the same material. For PETG/ABS, the friction fit is usually sufficient. For PLA, consider adding an M3×12mm bolt through each lockpin hole for positive retention. Print mountbars with 4+ wall loops for strength.
                      <br/><br/>
                      <b style={{color:"#f7b600"}}>Sheet Metal</b> — No split needed. Panel is a single flat pattern with bend lines. The flange, side walls, and rear panel are all formed from one piece. PEM fasteners or weld nuts for assembly.
                      <br/><br/>
                      <b style={{color:"#888"}}>Rear support</b> — The tray/bracket extends across the full width including split lines, acting as a structural bridge. For 3D prints, this is critical — it prevents the joint from flexing under device weight.
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* SPECS */}
          {tab==="specs"&&(
            <div style={{flex:1,overflowY:"auto",padding:24,maxWidth:680}}>
              <SL>PANEL</SL>
              <ST rows={[["Standard",`${std}" (EIA-310-E)`],["U-Height",`${uH}U`],["Panel W",`${panW.toFixed(2)}mm`],["Panel H",`${panH.toFixed(2)}mm`],["Total W",`${totW.toFixed(1)}mm`],["Depth",`${enclosureDepth.toFixed(0)}mm (auto)`]]}/>
              <div style={{height:14}}/>
              <SL>ENCLOSURE</SL>
              <ST rows={[["Flange Depth",`${flangeD}mm`],["Rear Panel",rearPanel?"Yes":"No (open back)"],["Ventilation",ventSlots?"Slotted":"Solid"],["Deepest Device",`${maxDeviceDepth||"—"}mm`],["Total Weight",`${totWt.toFixed(2)}kg`],["Ear-mount Safe",totWt<7?"✓ (<7kg)":"⚠ Use slide rails"]]}/>
              <div style={{height:14}}/>
              {fab==="sm"?(<><SL>SHEET METAL</SL><ST rows={[["Material",mt.name],["Thickness",`${mt.t}mm`],["Bend Radius",`${mt.br.toFixed(2)}mm`],["BA (90°)",`${BA90.toFixed(2)}mm`],["Min Flange",`${(2.5*mt.t+mt.br).toFixed(2)}mm`],["Hole→Edge",`≥${(2*mt.t).toFixed(1)}mm+r`],["Hole→Bend",`≥${(2*mt.t+mt.br).toFixed(1)}mm+r`]]}/></>):(<><SL>3D PRINT</SL><ST rows={[["Printer",pr.name],["Bed",pr.bed.join("×")+"mm"],["Filament",FILAMENTS[filament]?.name],["Wall",`${wallT}mm`],["Heat",FILAMENTS[filament]?.heat],["Split",needsSplit?splitInfo.type:"None needed"]]}/></>)}
              {els.length>0&&<><div style={{height:14}}/><SL>CUTOUT SCHEDULE ({els.length})</SL><div style={{background:"#161620",borderRadius:4,border:"1px solid #252530",overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:9}}><thead><tr style={{background:"#1e1e28",color:"#666",fontSize:8}}><TH>#</TH><TH>Type</TH><TH>Cut</TH><TH>Size</TH><TH>X</TH><TH>Y</TH><TH>Behind</TH></tr></thead><tbody>{els.map((el,i)=>{const c=el.type==="connector"?CONNECTORS[el.key]:null;const d=el.type==="device"?DEVICES[el.key]:null;return<tr key={el.id} style={{borderTop:"1px solid #1e1e28"}}><TD>{i+1}</TD><TD>{el.label}</TD><TD>{c?.cut||"rect"}</TD><TD>{c?.cut==="round"?`⌀${(c.r*2).toFixed(1)}`:`${el.w}×${el.h}`}</TD><TD>{el.x.toFixed(1)}</TD><TD>{el.y.toFixed(1)}</TD><TD>{c?.depthBehind||d?.d||"—"}mm</TD></tr>;})}</tbody></table></div></>}
            </div>
          )}

          {/* EXPORT */}
          {tab==="export"&&(
            <div style={{flex:1,overflowY:"auto",padding:24,maxWidth:680}}>
              <SL>EXPORT</SL>
              <EC t="JSON Config (Full Enclosure)" d="Complete parametric config: panel + enclosure depth + device bays + connector cutouts + split strategy + fabrication params. Drives Fusion 360 script or OpenSCAD generator." a="Copy JSON" onClick={()=>navigator.clipboard?.writeText(genJSON())}/>
              {fab==="3dp"&&<EC t={`STL → ${pr.name}`} d={`Generate in Fusion 360 → Export STL → Slice in BambuStudio. ${needsSplit?`Exports as ${splitInfo.parts.length} separate STL files for the ${splitInfo.type} split.`:"Single-piece STL."} Includes faceplate, side walls, tray floor, ${rearPanel?"rear panel,":""} and device retention features.`} a="Copy Config" onClick={()=>navigator.clipboard?.writeText(genJSON())}/>}
              <EC t="Fusion 360 Script" d={`Python script generates: faceplate + ${flangeD}mm flanges + ${enclosureDepth.toFixed(0)}mm deep enclosure + EIA-310 bores + all cutouts + device bay trays. ${fab==="sm"?"Sheet metal body with bend features.":"Solid body for 3D printing."}`} a="Copy Config" onClick={()=>navigator.clipboard?.writeText(genJSON())}/>
              {fab==="sm"&&<EC t="DXF Flat Pattern" d={`Fusion 360 → Sheet Metal → Flat Pattern → Export DXF. Est. flat: ${(panW+2*(flangeD+BA90)).toFixed(0)} × ${(panH+2*(flangeD+BA90)).toFixed(0)}mm`}/>}
              <EC t="Fab Service" d={fab==="sm"?"STEP → Protocase / SendCutSend / PCBWay":"STL → PCBWay (SLS/MJF) or slice locally for FDM"}/>
              {els.length>0&&<div style={{marginTop:14,background:"#161620",border:"1px solid #252530",borderRadius:5,padding:14}}><SL>CONFIG</SL><pre style={{fontSize:8,color:"#666",whiteSpace:"pre-wrap",wordBreak:"break-all",maxHeight:260,overflow:"auto",margin:0}}>{genJSON()}</pre></div>}
            </div>
          )}

          {/* Status */}
          <div style={{borderTop:"1px solid #252530",padding:"4px 12px",display:"flex",justifyContent:"space-between",fontSize:8,color:"#444",background:"#111116"}}>
            <span>{panW.toFixed(0)}×{panH.toFixed(0)}×{enclosureDepth.toFixed(0)}mm • {fab==="3dp"?`${pr.name}/${FILAMENTS[filament]?.name}`:mt.name} • {els.length} features</span>
            <span>{selEl?`${selEl.label} @ (${selEl.x.toFixed(1)},${selEl.y.toFixed(1)})`:"Drag to position"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/*───────── Sub-components ─────────*/
function SL({children}){return<div style={{fontSize:8,fontWeight:700,color:"#4a4a55",letterSpacing:".12em",marginBottom:5,marginTop:8}}>{children}</div>}
function Hr(){return<div style={{height:1,background:"#252530",margin:"8px 0"}}/>}
function R({children}){return<div style={{display:"flex",gap:5,marginBottom:6}}>{children}</div>}
function Sel({l,v,set,o,f}){return<label style={{display:"flex",flexDirection:"column",gap:1,flex:f?1:undefined,width:f?"100%":undefined}}><span style={{fontSize:7,color:"#4a4a55",letterSpacing:".08em"}}>{l}</span><select value={v} onChange={e=>set(e.target.value)} style={{background:"#1a1a22",color:"#ddd",border:"1px solid #252530",borderRadius:3,padding:"3px 5px",fontSize:9,fontFamily:"inherit",cursor:"pointer",outline:"none"}}>{o.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>}
function Sld({l,v,set,min,max,step,unit,color}){return<div style={{display:"flex",alignItems:"center",gap:6,fontSize:9,marginTop:4}}><span style={{color:"#555",minWidth:60}}>{l}</span><input type="range" min={min} max={max} step={step} value={v} onChange={e=>set(+e.target.value)} style={{flex:1,accentColor:color||"#f7b600"}}/><span style={{color:"#aaa",minWidth:30,textAlign:"right"}}>{v}{unit}</span></div>}
function Chk({l,v,set}){return<label style={{display:"flex",alignItems:"center",gap:4,fontSize:9,color:"#888",cursor:"pointer"}}><input type="checkbox" checked={v} onChange={e=>set(e.target.checked)} style={{accentColor:"#f7b600"}}/>{l}</label>}
function AB({children,active,onClick,c}){return<button onClick={onClick} style={{flex:1,padding:"5px 6px",background:active?c:"#1a1a22",color:active?"#111":"#777",border:active?"none":"1px solid #252530",borderRadius:3,fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{children}</button>}
function Pal({children}){return<div style={{background:"#151520",borderRadius:4,border:"1px solid #252530",padding:5,marginBottom:6,maxHeight:220,overflowY:"auto"}}>{children}</div>}
function PI({onClick,onMouseEnter,onMouseLeave,hovered,icon,ic,name,desc,meta}){return<button onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} style={{display:"flex",alignItems:"center",gap:6,width:"100%",padding:"4px 5px",background:hovered?"#1e1e2a":"transparent",border:"none",borderRadius:2,cursor:"pointer",textAlign:"left",color:"#e2e2e2",fontFamily:"inherit",fontSize:9}}><span style={{fontSize:13,color:ic,width:18,textAlign:"center"}}>{icon}</span><div style={{flex:1,minWidth:0}}><div style={{fontWeight:600}}>{name}</div><div style={{fontSize:7,color:"#555",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{desc}</div></div>{meta&&<div style={{fontSize:7,color:"#3a3a3a",whiteSpace:"nowrap"}}>{meta}</div>}</button>}
function MB({children,onClick,d}){return<button onClick={onClick} style={{background:"transparent",border:"none",color:d?"#ef4444":"#444",cursor:"pointer",fontSize:10,padding:"0 1px",fontFamily:"inherit"}}>{children}</button>}
function PR({l,v}){return<div style={{display:"flex",justifyContent:"space-between",padding:"1px 0",borderBottom:"1px solid #151520",fontSize:9}}><span style={{color:"#4a4a55"}}>{l}</span><span style={{color:"#bbb"}}>{v}</span></div>}
function ST({rows}){return<div style={{background:"#161620",borderRadius:4,border:"1px solid #252530",overflow:"hidden"}}>{rows.map(([l,v],i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 8px",borderTop:i?"1px solid #1e1e28":"none",fontSize:9}}><span style={{color:"#555"}}>{l}</span><span style={{color:"#ddd",fontWeight:500}}>{v}</span></div>)}</div>}
function EC({t,d,a,onClick}){return<div style={{background:"#161620",border:"1px solid #252530",borderRadius:5,padding:12,marginBottom:8}}><div style={{fontWeight:700,fontSize:11,color:"#f7f7f7"}}>{t}</div><div style={{fontSize:9,color:"#666",margin:"4px 0"}}>{d}</div>{a&&<button onClick={onClick} style={{background:onClick?"#f7b600":"#252530",color:onClick?"#111":"#555",border:"none",borderRadius:3,padding:"4px 10px",fontSize:9,fontWeight:600,cursor:onClick?"pointer":"default",fontFamily:"inherit"}}>{a}</button>}</div>}
function TH({children}){return<th style={{padding:"4px 6px",textAlign:"left",fontWeight:600}}>{children}</th>}
function TD({children}){return<td style={{padding:"4px 6px",color:"#bbb"}}>{children}</td>}
