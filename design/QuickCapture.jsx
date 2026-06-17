import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Command, Mic, CornerDownLeft, Settings as SettingsIcon, Check, ChevronDown,
  Power, Pause, X, Keyboard, Palette, Link2, Plus, Zap, Layout, ArrowUpRight
} from 'lucide-react';

/* ------------------------------------------------------------------ tokens */
const T = {
  text: '#EDEEF5',
  sub: '#9A9DB2',
  faint: '#6A6D83',
  glass: 'rgba(18,20,32,0.72)',
  glassSolid: 'rgba(16,18,29,0.92)',
  border: 'rgba(255,255,255,0.09)',
  hairline: 'rgba(255,255,255,0.06)',
  field: 'rgba(255,255,255,0.045)',
  accent: '#6E7BFF',
  accent2: '#9A7BFF',
  success: '#34D6A0',
};

const SAMPLE = 'Follow up with Andrew about the Redis cache warming job';

const CSS = `
*{box-sizing:border-box}
.qc-root *{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}
.mono{font-family:ui-monospace,'SF Mono','Cascadia Code',Menlo,monospace}

@keyframes backdropIn{from{opacity:0}to{opacity:1}}
@keyframes modalIn{
  from{opacity:0;transform:translateY(12px) scale(.965);filter:blur(6px)}
  to{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}
}
@keyframes panelIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes tabIn{from{opacity:0;transform:translateX(6px)}to{opacity:1;transform:none}}
@keyframes orb{0%,100%{transform:translate(0,0)}50%{transform:translate(24px,-30px)}}
@keyframes ring{0%{transform:scale(1);opacity:.55}100%{transform:scale(2.1);opacity:0}}
@keyframes eq{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}
@keyframes fly{
  0%{opacity:1;transform:translate(0,0) scale(1) rotate(0)}
  35%{opacity:1;transform:translate(0,-6px) scale(.96) rotate(-1deg)}
  100%{opacity:0;transform:translate(180px,-260px) scale(.32) rotate(9deg)}
}
@keyframes toastIn{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes shake{10%,90%{transform:translateX(-2px)}30%,70%{transform:translateX(4px)}50%{transform:translateX(-4px)}}
@keyframes trayIn{from{opacity:0;transform:translateY(6px) scale(.97)}to{opacity:1;transform:none}}

.btn{transition:background .18s ease,border-color .18s ease,transform .12s ease,box-shadow .18s ease;cursor:pointer}
.btn:hover{transform:translateY(-1px)}
.btn:active{transform:translateY(0)}
.icon-btn{transition:background .18s ease,color .18s ease,transform .12s ease}
.icon-btn:hover{background:rgba(255,255,255,0.08);color:${T.text}}
.icon-btn:active{transform:scale(.92)}

.field-wrap{transition:border-color .2s ease,box-shadow .2s ease,background .2s ease}
.field-wrap:focus-within{border-color:${T.accent}!important;box-shadow:0 0 0 4px rgba(110,123,255,0.16)!important}
input.bare{background:transparent;border:none;outline:none;color:${T.text};width:100%}
input.bare::placeholder{color:${T.faint}}

.seg{transition:color .18s ease}
.row{transition:background .15s ease}
.row:hover{background:rgba(255,255,255,0.04)}
.swatch{transition:transform .14s ease,box-shadow .18s ease;cursor:pointer}
.swatch:hover{transform:scale(1.12)}
.tog{transition:background .2s ease}
.tog-knob{transition:transform .22s cubic-bezier(.16,1,.3,1)}
.linkish{transition:color .15s ease}
.linkish:hover{color:${T.accent}!important}
.shake{animation:shake .32s ease}

@media (prefers-reduced-motion:reduce){
  *{animation-duration:.001ms!important;animation-iteration-count:1!important}
}
`;

/* ------------------------------------------------------------------ keycap */
function Key({ children, accent }) {
  return (
    <span className="mono" style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 22, height: 22, padding: '0 6px', fontSize: 11.5, fontWeight: 600,
      color: accent ? '#fff' : T.sub,
      background: accent ? T.accent : 'rgba(255,255,255,0.06)',
      border: `1px solid ${accent ? 'transparent' : T.border}`,
      borderRadius: 6,
      boxShadow: accent ? 'none' : 'inset 0 -1px 0 rgba(0,0,0,0.25)',
    }}>{children}</span>
  );
}

/* --------------------------------------------------------------- capture */
function Capture({ target }) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [sending, setSending] = useState(false);
  const [flyTxt, setFlyTxt] = useState('');
  const [toast, setToast] = useState(false);
  const [shake, setShake] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const inputRef = useRef(null);
  const timers = useRef([]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => () => clearTimers(), []);
  useEffect(() => { inputRef.current?.focus(); }, [animKey]);

  const startVoice = () => {
    if (listening) { setListening(false); clearTimers(); return; }
    setListening(true); setText('');
    const words = SAMPLE.split(' ');
    words.forEach((w, i) => {
      timers.current.push(setTimeout(() => {
        setText(t => (t ? t + ' ' : '') + w);
      }, 220 + i * 150));
    });
    timers.current.push(setTimeout(() => setListening(false), 260 + words.length * 150));
  };

  const send = () => {
    if (!text.trim()) { setShake(true); setTimeout(() => setShake(false), 340); return; }
    setFlyTxt(text); setSending(true); setListening(false); clearTimers();
    timers.current.push(setTimeout(() => {
      setSending(false); setText(''); setToast(true);
      timers.current.push(setTimeout(() => setToast(false), 1700));
    }, 760));
  };

  const replay = () => { clearTimers(); setText(''); setToast(false); setSending(false); setListening(false); setAnimKey(k => k + 1); };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '20vh' }}>
      <div key={animKey} style={{ position: 'absolute', inset: 0, background: 'rgba(6,7,12,0.45)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', animation: 'backdropIn .35s ease both' }} onClick={replay} />

      <div key={'m' + animKey} className={shake ? 'shake' : ''} style={{
        position: 'relative', width: 580, maxWidth: '92vw',
        background: T.glass, backdropFilter: 'blur(28px) saturate(160%)', WebkitBackdropFilter: 'blur(28px) saturate(160%)',
        border: `1px solid ${T.border}`, borderRadius: 18,
        boxShadow: '0 24px 70px -12px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.08)',
        animation: 'modalIn .42s cubic-bezier(.16,1,.3,1) both', overflow: 'hidden',
      }}>
        {/* input row */}
        <div className="field-wrap" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 18px 16px' }}>
          <div style={{ position: 'relative', width: 26, height: 26, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            {listening && <>
              <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px solid ${T.accent}`, animation: 'ring 1.4s ease-out infinite' }} />
              <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px solid ${T.accent}`, animation: 'ring 1.4s ease-out .7s infinite' }} />
            </>}
            <Zap size={18} color={listening ? T.accent : T.faint} style={{ transition: 'color .2s' }} />
          </div>

          {sending
            ? <div style={{ flex: 1, height: 24, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 0, top: 0, color: T.text, fontSize: 16, fontWeight: 500, whiteSpace: 'nowrap', animation: 'fly .76s cubic-bezier(.5,0,.75,0) both',
                  background: 'linear-gradient(135deg,rgba(110,123,255,.22),rgba(154,123,255,.12))', border: `1px solid ${T.border}`, borderRadius: 8, padding: '2px 10px' }}>{flyTxt}</span>
              </div>
            : <input ref={inputRef} className="bare" value={text} onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') send(); }}
                placeholder={listening ? 'Listening…' : 'What needs doing?'}
                style={{ fontSize: 16, fontWeight: 500, letterSpacing: '-0.01em' }} />}

          {listening
            ? <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 22, flexShrink: 0 }}>
                {[0, 1, 2, 3, 4].map(i => <span key={i} style={{ width: 3, height: 22, borderRadius: 2, background: T.accent, transformOrigin: 'bottom', animation: `eq ${0.7 + (i % 3) * 0.18}s ease-in-out ${i * 0.09}s infinite` }} />)}
              </div>
            : <button className="icon-btn btn" onClick={startVoice} title="Dictate"
                style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}`, color: T.sub, flexShrink: 0 }}>
                <Mic size={17} />
              </button>}
        </div>

        {/* footer bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderTop: `1px solid ${T.hairline}`, background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: T.faint, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Sends to</span>
            <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}`, color: T.text, fontSize: 12.5, fontWeight: 500 }}>
              <Layout size={13} color={T.accent} />
              {target.board} <span style={{ color: T.faint }}>/</span> {target.list}
              <ChevronDown size={13} color={T.faint} />
            </button>
          </div>
          <button className="btn" onClick={send} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 9, background: T.accent, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 4px 14px -4px rgba(110,123,255,0.7)' }}>
            Add card <CornerDownLeft size={14} />
          </button>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'absolute', top: 'calc(20vh - 52px)', left: '50%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 15px', borderRadius: 11, background: T.glassSolid, border: `1px solid ${T.border}`, boxShadow: '0 12px 30px -8px rgba(0,0,0,0.6)', animation: 'toastIn .3s cubic-bezier(.16,1,.3,1) both' }}>
          <span style={{ display: 'grid', placeItems: 'center', width: 18, height: 18, borderRadius: '50%', background: T.success }}><Check size={12} color="#06281f" strokeWidth={3} /></span>
          <span style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>Added to <span style={{ color: T.success }}>{target.list}</span></span>
        </div>
      )}

      <button className="linkish" onClick={replay} style={{ position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'none', border: 'none', color: T.faint, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
        Replay entrance · or press <Key>Ctrl</Key><Key>Alt</Key><Key>Space</Key>
      </button>
    </div>
  );
}

/* --------------------------------------------------------------- settings */
function Toggle({ on, set }) {
  return (
    <button className="tog btn" onClick={() => set(!on)} style={{ width: 42, height: 25, borderRadius: 13, border: 'none', padding: 3, background: on ? T.accent : 'rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex' }}>
      <span className="tog-knob" style={{ width: 19, height: 19, borderRadius: '50%', background: '#fff', transform: on ? 'translateX(17px)' : 'translateX(0)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </button>
  );
}

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
        <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>{label}</span>
        {hint && <span className="linkish" style={{ fontSize: 11.5, color: T.faint, cursor: 'pointer' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Settings({ target, setTarget }) {
  const [tab, setTab] = useState('general');
  const [recording, setRecording] = useState(false);
  const [combo, setCombo] = useState(['Ctrl', 'Alt', 'Space']);
  const [startup, setStartup] = useState(true);
  const [sound, setSound] = useState(true);
  const [clip, setClip] = useState(false);
  const [accent, setAccent] = useState(T.accent);
  const [connected, setConnected] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!recording) return;
    const fn = (e) => {
      e.preventDefault();
      const parts = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      const k = e.key.length === 1 ? e.key.toUpperCase() : e.key.replace(' ', 'Space');
      if (!['Control', 'Alt', 'Shift'].includes(e.key)) { parts.push(k); setCombo(parts); setRecording(false); }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [recording]);

  const tabs = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'trello', label: 'Trello', icon: Link2 },
    { id: 'appearance', label: 'Appearance', icon: Palette },
  ];
  const accents = ['#6E7BFF', '#34D6A0', '#FF8A5B', '#F25C9B', '#52B6FF', '#C792EA'];
  const boards = ['Personal Tasks', 'BAD SIGNAL', 'McKinley Web', 'Errands'];
  const lists = ['Inbox', 'To Do', 'Doing', 'Ideas'];

  const inputStyle = { display: 'flex', alignItems: 'center', padding: '11px 13px', borderRadius: 10, background: T.field, border: `1px solid ${T.border}` };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{
        width: 720, maxWidth: '94vw', height: 560, maxHeight: '88vh', display: 'flex',
        background: T.glassSolid, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${T.border}`, borderRadius: 18, overflow: 'hidden',
        boxShadow: '0 30px 80px -16px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.07)',
        animation: 'panelIn .4s cubic-bezier(.16,1,.3,1) both',
      }}>
        {/* sidebar */}
        <div style={{ width: 196, flexShrink: 0, borderRight: `1px solid ${T.hairline}`, padding: 16, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.015)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 8px 18px' }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg,${accent},${T.accent2})`, boxShadow: `0 4px 12px -3px ${accent}99` }}>
              <Zap size={16} color="#fff" />
            </span>
            <span style={{ fontWeight: 700, fontSize: 14, color: T.text, letterSpacing: '-0.01em' }}>Quickdrop</span>
          </div>
          {tabs.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} className="row btn" onClick={() => setTab(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', marginBottom: 2, borderRadius: 9,
                background: active ? 'rgba(255,255,255,0.07)' : 'transparent', border: 'none', cursor: 'pointer',
                color: active ? T.text : T.sub, fontSize: 13.5, fontWeight: active ? 600 : 500, textAlign: 'left',
              }}>
                <t.icon size={16} color={active ? accent : T.faint} /> {t.label}
              </button>
            );
          })}
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 11.5, color: T.faint }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? T.success : T.faint }} />
            {connected ? 'Trello connected' : 'Not connected'}
          </div>
        </div>

        {/* content */}
        <div key={tab} style={{ flex: 1, padding: '26px 28px', overflowY: 'auto', animation: 'tabIn .26s ease both' }}>
          {tab === 'general' && <>
            <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: T.text }}>General</h2>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: T.faint }}>How and when the capture bar appears.</p>

            <Field label="Capture shortcut">
              <button className="field-wrap btn" onClick={() => setRecording(true)} style={{ ...inputStyle, justifyContent: 'space-between', width: '100%', cursor: 'pointer' }}>
                {recording
                  ? <span style={{ color: accent, fontSize: 13, fontWeight: 500 }}>Press your keys…</span>
                  : <span style={{ display: 'flex', gap: 5 }}>{combo.map((k, i) => <Key key={i}>{k}</Key>)}</span>}
                <Keyboard size={16} color={T.faint} />
              </button>
            </Field>

            {[['Launch at startup', 'Open Quickdrop when Windows starts', startup, setStartup],
              ['Sound on capture', 'Play a soft chime when a card is added', sound, setSound],
              ['Prefill from clipboard', 'Drop clipboard text into the field on open', clip, setClip]].map(([t, d, v, s], i) => (
              <div key={i} className="row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 12px', margin: '0 -12px', borderRadius: 10 }}>
                <div>
                  <div style={{ fontSize: 13.5, color: T.text, fontWeight: 500 }}>{t}</div>
                  <div style={{ fontSize: 12, color: T.faint, marginTop: 2 }}>{d}</div>
                </div>
                <Toggle on={v} set={s} />
              </div>
            ))}
          </>}

          {tab === 'trello' && <>
            <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: T.text }}>Trello</h2>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: T.faint }}>Connect your account, then pick where cards land.</p>

            <Field label="API key" hint="Where do I get this?">
              <div className="field-wrap" style={inputStyle}><input className="bare" placeholder="Paste your API key" style={{ fontSize: 13 }} /></div>
            </Field>
            <Field label="Token" hint="Where do I get this?">
              <div className="field-wrap" style={inputStyle}><input className="bare" type="password" defaultValue="••••••••••••••••" style={{ fontSize: 13 }} /></div>
            </Field>

            <button className="btn" onClick={() => { setTesting(true); setTimeout(() => { setTesting(false); setConnected(true); }, 900); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, border: `1px solid ${connected ? T.success : T.border}`, background: connected ? 'rgba(52,214,160,0.1)' : 'rgba(255,255,255,0.05)', color: connected ? T.success : T.text, fontSize: 13, fontWeight: 600, marginBottom: 24 }}>
              {testing ? <><span style={{ width: 14, height: 14, border: `2px solid ${T.faint}`, borderTopColor: T.text, borderRadius: '50%', animation: 'eq 0s, spin .7s linear infinite' }} /> Testing…</>
                : connected ? <><Check size={15} /> Connected</> : <><Link2 size={15} /> Test connection</>}
            </button>

            <div style={{ height: 1, background: T.hairline, margin: '0 -28px 22px' }} />

            <Field label="Board">
              <div className="field-wrap" style={{ ...inputStyle, justifyContent: 'space-between', opacity: connected ? 1 : 0.5, pointerEvents: connected ? 'auto' : 'none' }}>
                <select value={target.board} onChange={e => setTarget(t => ({ ...t, board: e.target.value }))} style={{ background: 'transparent', border: 'none', color: T.text, fontSize: 13, outline: 'none', width: '100%', appearance: 'none', cursor: 'pointer' }}>
                  {boards.map(b => <option key={b} style={{ background: '#15171f' }}>{b}</option>)}
                </select>
                <ChevronDown size={15} color={T.faint} />
              </div>
            </Field>
            <Field label="List">
              <div className="field-wrap" style={{ ...inputStyle, justifyContent: 'space-between', opacity: connected ? 1 : 0.5, pointerEvents: connected ? 'auto' : 'none' }}>
                <select value={target.list} onChange={e => setTarget(t => ({ ...t, list: e.target.value }))} style={{ background: 'transparent', border: 'none', color: T.text, fontSize: 13, outline: 'none', width: '100%', appearance: 'none', cursor: 'pointer' }}>
                  {lists.map(l => <option key={l} style={{ background: '#15171f' }}>{l}</option>)}
                </select>
                <ChevronDown size={15} color={T.faint} />
              </div>
            </Field>
          </>}

          {tab === 'appearance' && <>
            <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: T.text }}>Appearance</h2>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: T.faint }}>Make it yours.</p>

            <Field label="Accent color">
              <div style={{ display: 'flex', gap: 12 }}>
                {accents.map(c => (
                  <button key={c} className="swatch" onClick={() => setAccent(c)} style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: 'none', boxShadow: accent === c ? `0 0 0 2px #15171f, 0 0 0 4px ${c}` : 'none' }} />
                ))}
              </div>
            </Field>

            <Field label="Theme">
              <div style={{ display: 'flex', gap: 6, padding: 4, background: T.field, borderRadius: 11, border: `1px solid ${T.border}`, width: 'fit-content' }}>
                {['Dark', 'Light', 'Auto'].map((m, i) => (
                  <button key={m} className="seg btn" style={{ padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: i === 0 ? 'rgba(255,255,255,0.09)' : 'transparent', color: i === 0 ? T.text : T.faint }}>{m}</button>
                ))}
              </div>
            </Field>

            <Field label="Bar width">
              <div style={{ display: 'flex', gap: 6, padding: 4, background: T.field, borderRadius: 11, border: `1px solid ${T.border}`, width: 'fit-content' }}>
                {['Compact', 'Default', 'Wide'].map((m, i) => (
                  <button key={m} className="seg btn" style={{ padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: i === 1 ? 'rgba(255,255,255,0.09)' : 'transparent', color: i === 1 ? T.text : T.faint }}>{m}</button>
                ))}
              </div>
            </Field>
          </>}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* --------------------------------------------------------------- tray */
function Tray({ open, setOpen, setView }) {
  if (!open) return null;
  const items = [
    { icon: Zap, label: 'Capture a thought', sub: 'Ctrl Alt Space', act: () => setView('capture') },
    { icon: SettingsIcon, label: 'Settings', act: () => setView('settings') },
    { icon: Pause, label: 'Pause shortcut' },
    { icon: Power, label: 'Quit Quickdrop', danger: true },
  ];
  return (
    <div style={{ position: 'absolute', bottom: 52, right: 16, width: 234, padding: 6, background: T.glassSolid, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', border: `1px solid ${T.border}`, borderRadius: 13, boxShadow: '0 18px 50px -10px rgba(0,0,0,0.7)', animation: 'trayIn .2s cubic-bezier(.16,1,.3,1) both', zIndex: 50 }}>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i === 2 && <div style={{ height: 1, background: T.hairline, margin: '5px 8px' }} />}
          <button className="row btn" onClick={() => { it.act?.(); setOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '9px 10px', borderRadius: 9, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
            <it.icon size={16} color={it.danger ? '#FF6B6B' : T.sub} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: it.danger ? '#FF6B6B' : T.text }}>{it.label}</span>
            {it.sub && <span className="mono" style={{ fontSize: 10.5, color: T.faint }}>{it.sub}</span>}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- app */
export default function App() {
  const [view, setView] = useState('capture');
  const [tray, setTray] = useState(false);
  const [target, setTarget] = useState({ board: 'Personal Tasks', list: 'Inbox' });

  useEffect(() => {
    const fn = (e) => {
      if (e.ctrlKey && e.altKey && e.code === 'Space') { e.preventDefault(); setView('capture'); }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  return (
    <div className="qc-root" style={{ position: 'relative', width: '100%', height: '100vh', minHeight: 620, overflow: 'hidden',
      background: 'radial-gradient(120% 110% at 18% 0%, #1c2042 0%, #0b0c14 52%), radial-gradient(110% 110% at 100% 100%, #2a1944 0%, rgba(11,12,20,0) 58%), #090a12' }}>
      <style>{CSS}</style>

      {/* ambient orbs */}
      <div style={{ position: 'absolute', top: '12%', left: '12%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle,#5b6cff44,transparent 70%)', filter: 'blur(20px)', animation: 'orb 16s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', bottom: '8%', right: '14%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle,#9a5bff33,transparent 70%)', filter: 'blur(24px)', animation: 'orb 20s ease-in-out infinite reverse' }} />

      {/* preview switcher */}
      <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 40, display: 'flex', gap: 4, padding: 4, background: T.glass, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: `1px solid ${T.border}`, borderRadius: 11 }}>
        {[['capture', 'Capture bar'], ['settings', 'Settings']].map(([id, label]) => (
          <button key={id} className="btn" onClick={() => setView(id)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, background: view === id ? 'rgba(255,255,255,0.1)' : 'transparent', color: view === id ? T.text : T.faint }}>{label}</button>
        ))}
      </div>

      {view === 'capture' ? <Capture target={target} /> : <Settings target={target} setTarget={setTarget} />}

      {/* faux taskbar + tray */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 44, background: 'rgba(8,9,15,0.6)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderTop: `1px solid ${T.hairline}`, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 16, gap: 14 }}>
        <Tray open={tray} setOpen={setTray} setView={(v) => { setView(v); }} />
        <button className="icon-btn btn" onClick={() => setTray(t => !t)} title="Quickdrop - click for menu" style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 8, background: tray ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', cursor: 'pointer' }}>
          <span style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: 6, background: `linear-gradient(135deg,${T.accent},${T.accent2})` }}>
            <Zap size={13} color="#fff" />
          </span>
        </button>
        <span className="mono" style={{ fontSize: 12, color: T.faint }}>9:41</span>
      </div>
    </div>
  );
}
