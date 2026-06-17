/* Design tokens lifted verbatim from design/QuickCapture.jsx.
   `accent` is the default; the live accent is applied via a CSS variable (see accent.ts). */
export const T = {
  text: "#EDEEF5",
  sub: "#9A9DB2",
  faint: "#6A6D83",
  glass: "rgba(18,20,32,0.72)",
  glassSolid: "rgba(16,18,29,0.92)",
  border: "rgba(255,255,255,0.09)",
  hairline: "rgba(255,255,255,0.06)",
  field: "rgba(255,255,255,0.045)",
  accent: "#6E7BFF",
  accent2: "#9A7BFF",
  success: "#34D6A0",
};

export const DEFAULT_ACCENT = T.accent;

/* Global CSS. Voice-only keyframes (orb/ring/eq) removed; spin kept for the
   Test-connection spinner. `--accent` drives live accent theming. */
export const CSS = `
*{box-sizing:border-box}
:root{--accent:${T.accent}}
html,body{margin:0;padding:0;background:transparent}
#root{height:100vh}
.qc-root *{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}
.mono{font-family:ui-monospace,'SF Mono','Cascadia Code',Menlo,monospace}

@keyframes backdropIn{from{opacity:0}to{opacity:1}}
@keyframes modalIn{
  from{opacity:0;transform:translateY(12px) scale(.965);filter:blur(6px)}
  to{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}
}
@keyframes panelIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes tabIn{from{opacity:0;transform:translateX(6px)}to{opacity:1;transform:none}}
@keyframes fly{
  0%{opacity:1;transform:translate(0,0) scale(1) rotate(0)}
  35%{opacity:1;transform:translate(0,-6px) scale(.96) rotate(-1deg)}
  100%{opacity:0;transform:translate(180px,-260px) scale(.32) rotate(9deg)}
}
@keyframes toastIn{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes shake{10%,90%{transform:translateX(-2px)}30%,70%{transform:translateX(4px)}50%{transform:translateX(-4px)}}
@keyframes spin{to{transform:rotate(360deg)}}

.btn{transition:filter .15s ease,background .18s ease,border-color .18s ease,box-shadow .18s ease;cursor:pointer}
.btn:hover{filter:brightness(.88)}
.btn:active{filter:brightness(.78)}
.icon-btn{transition:filter .15s ease,background .18s ease,color .18s ease}
.icon-btn:hover{filter:brightness(.88)}
.icon-btn:active{filter:brightness(.78)}

.field-wrap{transition:border-color .2s ease,box-shadow .2s ease,background .2s ease}
.field-wrap:focus-within{border-color:var(--accent)!important;box-shadow:0 0 0 4px rgba(110,123,255,0.16)!important}
input.bare,textarea.bare{background:transparent;border:none;outline:none;color:${T.text};width:100%;font-family:inherit}
input.bare::placeholder,textarea.bare::placeholder{color:${T.faint}}

.seg{transition:color .18s ease}
.row{transition:background .15s ease}
.row:hover{background:rgba(255,255,255,0.04)}
.swatch{transition:transform .14s ease,box-shadow .18s ease;cursor:pointer}
.swatch:hover{transform:scale(1.12)}
.tog{transition:background .2s ease}
.tog-knob{transition:transform .22s cubic-bezier(.16,1,.3,1)}
.linkish{transition:color .15s ease}
.linkish:hover{color:var(--accent)!important}
.shake{animation:shake .32s ease}

/* Scrollbars - slim, dark, theme-matched (Chromium/WebView2). The 3px
   transparent border + padding-box clip floats a thin thumb inside the track.
   Use background-color (not the background shorthand) so hover/active don't
   reset the clip and fatten the thumb. */
::-webkit-scrollbar{width:12px;height:12px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background-color:rgba(255,255,255,0.13);border:3px solid transparent;border-radius:8px;background-clip:padding-box}
::-webkit-scrollbar-thumb:hover{background-color:rgba(255,255,255,0.22)}
::-webkit-scrollbar-thumb:active{background-color:var(--accent)}
::-webkit-scrollbar-corner{background:transparent}

@media (prefers-reduced-motion:reduce){
  *{animation-duration:.001ms!important;animation-iteration-count:1!important}
}
`;
