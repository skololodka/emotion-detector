import { useState, useRef, useEffect, useCallback } from "react";

const EMOTIONS = {
  радость: "😄", счастье: "😊", грусть: "😢", злость: "😠",
  удивление: "😲", страх: "😨", отвращение: "🤢", нейтральный: "😐",
  спокойствие: "😌", смущение: "😳", скука: "😒", задумчивость: "🤔",
  усталость: "😴", восхищение: "🤩", тревога: "😟",
};

function getEmoji(emotion = "") {
  const key = Object.keys(EMOTIONS).find(k => emotion.toLowerCase().includes(k));
  return key ? EMOTIONS[key] : "🔍";
}

export default function EmotionDetector() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [typedText, setTypedText] = useState("");

  const typeText = useCallback((text) => {
    setTypedText("");
    let i = 0;
    const iv = setInterval(() => {
      if (i >= text.length) { clearInterval(iv); return; }
      setTypedText(prev => prev + text[i]);
      i++;
    }, 14);
  }, []);

  const startCamera = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOn(true);
    } catch (e) {
      setError("Нет доступа к камере. Разреши его в настройках Chrome (🔒 рядом с адресной строкой).");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (intervalRef.current) clearInterval(intervalRef.current);
    streamRef.current = null;
    setCameraOn(false);
    setAutoMode(false);
  };

  const captureBase64 = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return null;
    c.width = v.videoWidth || 640;
    c.height = v.videoHeight || 480;
    c.getContext("2d").drawImage(v, 0, 0);
    return c.toDataURL("image/jpeg", 0.85).split(",")[1];
  };

  const analyze = useCallback(async () => {
    if (analyzing || !streamRef.current) return;
    setAnalyzing(true);
    setFlash(true); setTimeout(() => setFlash(false), 250);
    setScanning(true); setTimeout(() => setScanning(false), 1800);
    typeText("Анализирую...");

    try {
      const img = captureBase64();
      if (!img) throw new Error("no frame");

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: img } },
              { type: "text", text: `Ты — эксперт по распознаванию эмоций. Проанализируй выражение лица.
Ответь СТРОГО JSON (без markdown):
{"emotion":"название на русском","confidence":0-100,"description":"3-4 предложения о мимике","tips":"короткий совет"}
Если лица нет — emotion: "нет лица".` }
            ]
          }]
        })
      });

      const data = await resp.json();
      const raw = (data.content || []).map(b => b.text || "").join("");
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());

      setResult(parsed);
      setHistory(h => [{ emotion: parsed.emotion, emoji: getEmoji(parsed.emotion) }, ...h].slice(0, 8));
      typeText(`${parsed.description}\n\n💡 ${parsed.tips}`);
    } catch (e) {
      typeText("⚠ Ошибка анализа — попробуй ещё раз.");
    }
    setAnalyzing(false);
  }, [analyzing, typeText]);

  const toggleAuto = () => {
    if (!cameraOn) return;
    if (!autoMode) {
      analyze();
      intervalRef.current = setInterval(analyze, 5000);
      setAutoMode(true);
    } else {
      clearInterval(intervalRef.current);
      setAutoMode(false);
    }
  };

  useEffect(() => () => { stopCamera(); }, []);

  const emoji = result ? getEmoji(result.emotion) : "◌";

  return (
    <div style={{
      fontFamily: "'Space Mono', monospace",
      background: "#0a0a0f",
      color: "#e8e8f0",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=Space+Mono&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #1e1e2e; }
        @keyframes scanAnim { 0%{top:0%} 100%{top:100%} }
        @keyframes pop { 0%{transform:scale(1)} 50%{transform:scale(1.4)} 100%{transform:scale(1)} }
        @keyframes blink { 50%{opacity:0} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes chip { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }
        @keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>

      {/* Header */}
      <div style={{ padding: "20px 32px", borderBottom: "1px solid #1e1e2e", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "Syne,sans-serif", fontWeight: 800, fontSize: 20 }}>
          emo<span style={{ color: "#c8ff00", display:"inline-block", transform:"skewX(-8deg)" }}>SCAN</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 14px", border:"1px solid #1e1e2e", borderRadius:100, fontSize:11, color:"#4a4a6a", letterSpacing:"0.05em", textTransform:"uppercase" }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background: cameraOn ? "#c8ff00" : "#4a4a6a", boxShadow: cameraOn ? "0 0 8px #c8ff00" : "none", animation: cameraOn ? "pulseDot 2s ease-in-out infinite" : "none" }} />
          {analyzing ? "анализ..." : cameraOn ? "активна" : "ожидание"}
        </div>
      </div>

      {/* Body */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 380px", flex:1, minHeight:0 }}>

        {/* LEFT */}
        <div style={{ padding: "32px", borderRight:"1px solid #1e1e2e", display:"flex", flexDirection:"column", gap:20 }}>
          <div style={{ fontSize:10, letterSpacing:"0.2em", textTransform:"uppercase", color:"#4a4a6a", display:"flex", alignItems:"center", gap:12 }}>
            входящий поток
            <div style={{ flex:1, height:1, background:"#1e1e2e" }} />
          </div>

          {/* Video box */}
          <div style={{ position:"relative", aspectRatio:"4/3", maxWidth:560, border:"1px solid #1e1e2e", overflow:"hidden", background:"#12121a" }}>
            {/* Corner accents */}
            {[["top","left"],["top","right"],["bottom","left"],["bottom","right"]].map(([v,h]) => (
              <div key={v+h} style={{ position:"absolute", [v]:0, [h]:0, width:18, height:18,
                borderTop: v==="top" ? "2px solid #c8ff00" : "none",
                borderBottom: v==="bottom" ? "2px solid #c8ff00" : "none",
                borderLeft: h==="left" ? "2px solid #c8ff00" : "none",
                borderRight: h==="right" ? "2px solid #c8ff00" : "none",
                zIndex:5 }} />
            ))}

            {/* Flash */}
            {flash && <div style={{ position:"absolute", inset:0, background:"white", opacity:0.5, zIndex:6, pointerEvents:"none", transition:"opacity .2s" }} />}

            {/* Scan line */}
            {scanning && <div style={{ position:"absolute", left:0, right:0, height:2, background:"linear-gradient(90deg,transparent,#c8ff00,transparent)", boxShadow:"0 0 12px #c8ff00", zIndex:4, animation:"scanAnim 1.8s ease-in-out", animationFillMode:"forwards" }} />}

            <video ref={videoRef} autoPlay playsInline muted style={{ width:"100%", height:"100%", objectFit:"cover", display: cameraOn ? "block" : "none" }} />
            <canvas ref={canvasRef} style={{ display:"none" }} />

            {!cameraOn && (
              <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, color:"#4a4a6a", fontSize:13 }}>
                <div style={{ fontSize:40, opacity:0.3 }}>◉</div>
                <div>нажми «включить камеру»</div>
              </div>
            )}
          </div>

          {error && <div style={{ color:"#ff6b35", fontSize:12, padding:"10px 14px", border:"1px solid #ff6b3540", background:"#ff6b3510" }}>{error}</div>}

          {/* Buttons */}
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <Btn primary onClick={startCamera} disabled={cameraOn}>Включить камеру</Btn>
            <Btn danger onClick={stopCamera} disabled={!cameraOn}>Стоп</Btn>
            <Btn onClick={analyze} disabled={!cameraOn || analyzing}>
              {analyzing ? "⏳ анализ..." : "Анализировать"}
            </Btn>
          </div>

          {/* Auto toggle */}
          <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", border:"1px solid #1e1e2e", background:"#12121a", fontSize:12, color:"#4a4a6a" }}>
            <div onClick={toggleAuto} style={{ width:36, height:20, borderRadius:100, background: autoMode ? "#c8ff00" : "#1e1e2e", position:"relative", cursor: cameraOn ? "pointer" : "not-allowed", transition:"background .2s", flexShrink:0 }}>
              <div style={{ position:"absolute", width:14, height:14, borderRadius:"50%", background:"white", top:3, left:3, transition:"transform .2s", transform: autoMode ? "translateX(16px)" : "none" }} />
            </div>
            Авто-режим (каждые 5 сек)
            {analyzing && <div style={{ width:16, height:16, border:"2px solid #1e1e2e", borderTopColor:"#c8ff00", borderRadius:"50%", animation:"spin .6s linear infinite", marginLeft:"auto" }} />}
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ padding:"20px 28px", borderBottom:"1px solid #1e1e2e" }}>
            <div style={{ fontSize:10, letterSpacing:"0.2em", textTransform:"uppercase", color:"#4a4a6a" }}>анализ</div>
            <div style={{ fontFamily:"Syne,sans-serif", fontWeight:700, fontSize:14, textTransform:"uppercase", marginTop:6, letterSpacing:"0.05em" }}>Распознавание эмоций</div>
          </div>

          {/* Emotion hero */}
          <div style={{ padding:"32px 28px", borderBottom:"1px solid #1e1e2e", position:"relative", overflow:"hidden", minHeight:180 }}>
            <div style={{ position:"absolute", fontFamily:"Syne,sans-serif", fontWeight:800, fontSize:80, color:"rgba(200,255,0,0.07)", top:"50%", left:-8, transform:"translateY(-50%)", whiteSpace:"nowrap", textTransform:"uppercase", letterSpacing:-4, pointerEvents:"none", userSelect:"none" }}>
              {result ? result.emotion.toUpperCase() : ""}
            </div>
            <div style={{ fontSize:52, position:"relative", zIndex:1, lineHeight:1, animation: result ? "pop .5s cubic-bezier(.175,.885,.32,1.275)" : "none" }}>
              {emoji}
            </div>
            <div style={{ fontFamily:"Syne,sans-serif", fontWeight:800, fontSize:24, position:"relative", zIndex:1, marginTop:8, textTransform:"uppercase", color: result ? "#c8ff00" : "#e8e8f0" }}>
              {result ? result.emotion : "Жду кадр..."}
            </div>

            {result && (
              <div style={{ marginTop:10, position:"relative", zIndex:1 }}>
                <div style={{ fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", color:"#4a4a6a", display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <span>уверенность</span><span style={{ color:"#c8ff00" }}>{result.confidence}%</span>
                </div>
                <div style={{ height:3, background:"#1e1e2e", position:"relative", overflow:"hidden" }}>
                  <div style={{ height:"100%", background:"#c8ff00", width:`${result.confidence}%`, transition:"width .6s", boxShadow:"0 0 8px #c8ff00" }} />
                </div>
              </div>
            )}
          </div>

          {/* Text */}
          <div style={{ flex:1, overflowY:"auto", padding:"20px 28px" }}>
            <div style={{ fontSize:12, lineHeight:1.9, color: typedText.startsWith("⚠") ? "#ff6b35" : typedText === "Анализирую..." ? "#4a4a6a" : "#c8d0e0", whiteSpace:"pre-wrap" }}>
              {typedText || "Включи камеру и нажми «Анализировать»."}
              {analyzing && <span style={{ display:"inline-block", width:2, height:"1em", background:"#c8ff00", verticalAlign:"text-bottom", animation:"blink 1s step-end infinite", marginLeft:2 }} />}
            </div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div style={{ padding:"0 28px 20px", borderTop:"1px solid #1e1e2e" }}>
              <div style={{ fontSize:10, letterSpacing:"0.2em", textTransform:"uppercase", color:"#4a4a6a", padding:"14px 0 10px" }}>история</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {history.map((h, i) => (
                  <div key={i} style={{ padding:"3px 10px", border:"1px solid #1e1e2e", fontSize:11, color:"#4a4a6a", display:"flex", alignItems:"center", gap:4, animation:"chip .3s ease" }}>
                    {h.emoji} {h.emotion}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Btn({ children, onClick, disabled, primary, danger }) {
  const [hover, setHover] = useState(false);
  const base = {
    fontFamily: "'Space Mono',monospace", fontSize:11, letterSpacing:"0.08em",
    textTransform:"uppercase", padding:"10px 20px", border:"1px solid",
    cursor: disabled ? "not-allowed" : "pointer", transition:"all .2s",
    opacity: disabled ? 0.35 : 1, position:"relative", overflow:"hidden",
  };
  const styles = primary
    ? { ...base, background: hover ? "#fff" : "#c8ff00", color:"#0a0a0f", borderColor:"#c8ff00" }
    : danger
    ? { ...base, background: hover ? "#ff6b35" : "transparent", color: hover ? "#fff" : "#ff6b35", borderColor:"#ff6b35" }
    : { ...base, background: hover ? "#c8ff00" : "#12121a", color: hover ? "#0a0a0f" : "#e8e8f0", borderColor:"#1e1e2e" };

  return (
    <button style={styles} onClick={!disabled ? onClick : undefined}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {children}
    </button>
  );
}
