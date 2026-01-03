import { ref } from 'vue'

export function useNesEmulator(manifest, fileData, verified, loadingRef, errorRef, gameReady) {
  const emulatorIframe = ref(null)
  const romBlobUrl = ref(null)

  async function extractRomFromFile(data, manifestData) {
    const isZip = (data.length >= 2 && data[0] === 0x50 && data[1] === 0x4B) ||
                  (manifestData?.filename?.toLowerCase().endsWith('.zip'))

    if (isZip) {
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(data)
      
      let romFilename = null
      if (zip.files['run.json']) {
        try {
          const runJson = JSON.parse(await zip.files['run.json'].async('string'))
          romFilename = runJson.rom || runJson.executable
        } catch (e) {}
      }
      
      let romFile = null
      for (const [filename, file] of Object.entries(zip.files)) {
        if (file.dir) continue
        const lowerName = filename.toLowerCase()
        
        if (romFilename && lowerName.includes(romFilename.toLowerCase())) {
          romFile = { name: filename, file }
          break
        }
        
        if (lowerName.endsWith('.nes')) {
          romFile = { name: filename, file }
          if (!romFilename) break
        }
      }
      
      if (!romFile) throw new Error('No NES ROM found in ZIP')
      return { romData: await romFile.file.async('uint8array'), romName: romFile.name }
    }
    return { romData: data, romName: manifestData?.filename || 'game.nes' }
  }

  async function runGame(containerElement) {
    if (!verified.value || !fileData.value || !manifest.value) {
      if (errorRef?.value !== undefined) errorRef.value = 'Game not verified'
      return
    }

    if (loadingRef?.value !== undefined) loadingRef.value = true
    
    try {
      const { romData, romName } = await extractRomFromFile(fileData.value, manifest.value)
      if (!containerElement) throw new Error('Container not found')

      await cleanupEmulator()

      const blob = new Blob([romData], { type: 'application/octet-stream' })
      romBlobUrl.value = URL.createObjectURL(blob)

      const iframe = document.createElement('iframe')
      iframe.id = 'nes-emulator-iframe'
      iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;min-height:720px;background:#1a1a2e;'
      iframe.setAttribute('allow', 'autoplay')
      
      containerElement.appendChild(iframe)
      emulatorIframe.value = iframe

      const messageHandler = (event) => {
        if (event.source !== iframe.contentWindow) return
        if (event.data.type === 'emulator-ready') {
          gameReady.value = true
          if (loadingRef?.value !== undefined) loadingRef.value = false
        } else if (event.data.type === 'emulator-error') {
          if (errorRef?.value !== undefined) errorRef.value = event.data.error
          gameReady.value = false
          if (loadingRef?.value !== undefined) loadingRef.value = false
        }
      }
      window.addEventListener('message', messageHandler)
      iframe._messageHandler = messageHandler

      iframe.srcdoc = createNesHtml(romBlobUrl.value, romName)

    } catch (err) {
      if (errorRef?.value !== undefined) errorRef.value = err.message
      gameReady.value = false
      if (loadingRef?.value !== undefined) loadingRef.value = false
    }
  }

  function createNesHtml(romUrl, romName) {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;min-height:100%;background:#1a1a2e;overflow-x:hidden;overflow-y:auto}
body{display:flex;flex-direction:column;align-items:center;padding:10px}
#game{position:relative;background:#0f0f23;border-radius:12px;padding:12px;box-shadow:0 8px 32px rgba(0,0,0,0.6)}
#nes-canvas{width:512px;height:480px;image-rendering:pixelated;display:block;border-radius:4px;background:#000}
#loading{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;text-align:center}
#loading.hidden{display:none}
.spinner{width:40px;height:40px;border:3px solid rgba(255,255,255,0.3);border-top-color:#e74c3c;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 12px}
@keyframes spin{to{transform:rotate(360deg)}}
#inputStatus{color:#e74c3c;font-size:12px;margin-top:8px;text-align:center;min-height:20px}
#audioBtn{display:none;margin-top:10px;padding:10px 20px;background:#e74c3c;color:white;border:none;border-radius:6px;cursor:pointer}
#controller{display:flex;justify-content:space-between;width:100%;max-width:520px;margin-top:12px;padding:0 15px;user-select:none}
#controller_dpad{position:relative;width:120px;height:120px}
#controller_dpad>div{position:absolute;width:40px;height:40px;background:linear-gradient(145deg,#3a3a5a,#2a2a4a);border-radius:6px;display:flex;align-items:center;justify-content:center;color:#888;font-size:18px;cursor:pointer}
#controller_dpad>div:active{background:linear-gradient(145deg,#6a6a8a,#5a5a7a);color:#fff}
#controller_up{top:0;left:40px}#controller_down{bottom:0;left:40px}#controller_left{top:40px;left:0}#controller_right{top:40px;right:0}
.buttons-area{display:flex;flex-direction:column;align-items:center;gap:12px}
.ab-row{display:flex;gap:20px}
.roundBtn{width:56px;height:56px;border-radius:50%;background:linear-gradient(145deg,#e74c3c,#c0392b);display:flex;align-items:center;justify-content:center;color:#eee;font-weight:bold;font-size:18px;cursor:pointer}
.roundBtn:active{background:linear-gradient(145deg,#ff6b6b,#e74c3c)}
.system-row{display:flex;gap:20px}
.capsuleBtn{width:55px;height:20px;border-radius:10px;background:#3a3a5a;display:flex;align-items:center;justify-content:center;color:#888;font-size:10px;font-weight:bold;cursor:pointer}
.capsuleBtn:active{background:#6a6a8a;color:#fff}
@media(max-width:540px){#nes-canvas{width:100%;height:auto;max-width:512px}}
</style></head>
<body>
<div id="game"><canvas id="nes-canvas" width="256" height="240"></canvas><div id="loading"><div class="spinner"></div><div>Loading...</div></div></div>
<button id="audioBtn">Click for audio</button>
<div id="inputStatus"></div>
<div id="controller">
<div id="controller_dpad"><div id="controller_up">▲</div><div id="controller_down">▼</div><div id="controller_left">◀</div><div id="controller_right">▶</div></div>
<div class="buttons-area"><div class="ab-row"><div id="controller_b" class="roundBtn">B</div><div id="controller_a" class="roundBtn">A</div></div>
<div class="system-row"><div id="controller_select" class="capsuleBtn">SELECT</div><div id="controller_start" class="capsuleBtn">START</div></div></div>
</div>
<script src="https://unpkg.com/jsnes/dist/jsnes.min.js"></script>
<script>
const ROM_URL='${romUrl}';
const $=s=>document.querySelector(s);
let canvas_ctx,image,framebuffer_u8,framebuffer_u32;
let audio_samples_L=new Float32Array(4096),audio_samples_R=new Float32Array(4096),audio_wc=0,audio_rc=0,audio_started=false,audio_ctx;
let nes=null,animId=null;

function audio_remain(){return(audio_wc-audio_rc)&4095}
function audio_cb(e){if(!nes)return;const d=e.outputBuffer,l=d.length;if(audio_remain()<512&&nes)nes.frame();const dl=d.getChannelData(0),dr=d.getChannelData(1);for(let i=0;i<l;i++){const idx=(audio_rc+i)&4095;dl[i]=audio_samples_L[idx];dr[i]=audio_samples_R[idx]}audio_rc=(audio_rc+l)&4095}
function onFrame(){animId=requestAnimationFrame(onFrame);if(!nes)return;if(!audio_started)nes.frame();image.data.set(framebuffer_u8);canvas_ctx.putImageData(image,0,0)}
function setupInput(){const km={38:jsnes.Controller.BUTTON_UP,40:jsnes.Controller.BUTTON_DOWN,37:jsnes.Controller.BUTTON_LEFT,39:jsnes.Controller.BUTTON_RIGHT,88:jsnes.Controller.BUTTON_A,90:jsnes.Controller.BUTTON_B,65:jsnes.Controller.BUTTON_A,83:jsnes.Controller.BUTTON_B,9:jsnes.Controller.BUTTON_SELECT,13:jsnes.Controller.BUTTON_START};
const bn={[jsnes.Controller.BUTTON_UP]:'UP',[jsnes.Controller.BUTTON_DOWN]:'DOWN',[jsnes.Controller.BUTTON_LEFT]:'LEFT',[jsnes.Controller.BUTTON_RIGHT]:'RIGHT',[jsnes.Controller.BUTTON_A]:'A',[jsnes.Controller.BUTTON_B]:'B',[jsnes.Controller.BUTTON_SELECT]:'SELECT',[jsnes.Controller.BUTTON_START]:'START'};
document.addEventListener('keydown',e=>{const b=km[e.keyCode];if(b!==undefined&&nes){e.preventDefault();nes.buttonDown(1,b);$('#inputStatus').textContent=bn[b]||'';if(audio_ctx?.state==='suspended')audio_ctx.resume().then(()=>{audio_started=true;$('#audioBtn').style.display='none'})}});
document.addEventListener('keyup',e=>{const b=km[e.keyCode];if(b!==undefined&&nes){e.preventDefault();nes.buttonUp(1,b)}});
const bm={'controller_up':jsnes.Controller.BUTTON_UP,'controller_down':jsnes.Controller.BUTTON_DOWN,'controller_left':jsnes.Controller.BUTTON_LEFT,'controller_right':jsnes.Controller.BUTTON_RIGHT,'controller_a':jsnes.Controller.BUTTON_A,'controller_b':jsnes.Controller.BUTTON_B,'controller_start':jsnes.Controller.BUTTON_START,'controller_select':jsnes.Controller.BUTTON_SELECT};
for(const[id,b]of Object.entries(bm)){const el=document.getElementById(id);if(!el)continue;const dn=ev=>{ev.preventDefault();if(nes){nes.buttonDown(1,b);$('#inputStatus').textContent=bn[b]||'';if(audio_ctx?.state==='suspended')audio_ctx.resume().then(()=>{audio_started=true;$('#audioBtn').style.display='none'})}};const up=ev=>{ev.preventDefault();if(nes)nes.buttonUp(1,b)};el.addEventListener('touchstart',dn,{passive:false});el.addEventListener('touchend',up,{passive:false});el.addEventListener('mousedown',dn);el.addEventListener('mouseup',up);el.addEventListener('mouseleave',up)}}
function nes_init(){const c=$('#nes-canvas');canvas_ctx=c.getContext('2d');image=canvas_ctx.createImageData(256,240);canvas_ctx.fillStyle='black';canvas_ctx.fillRect(0,0,256,240);const buf=new ArrayBuffer(image.data.length);framebuffer_u8=new Uint8ClampedArray(buf);framebuffer_u32=new Uint32Array(buf);audio_ctx=new(window.AudioContext||window.webkitAudioContext)();const sp=audio_ctx.createScriptProcessor(512,0,2);sp.onaudioprocess=audio_cb;sp.connect(audio_ctx.destination);if(audio_ctx.state==='suspended')$('#audioBtn').style.display='block';else audio_started=true;nes=new jsnes.NES({onFrame:fb=>{for(let i=0;i<256*240;i++)framebuffer_u32[i]=0xFF000000|fb[i]},onAudioSample:(l,r)=>{audio_samples_L[audio_wc]=l;audio_samples_R[audio_wc]=r;audio_wc=(audio_wc+1)&4095}})}
async function start(){try{const r=await fetch(ROM_URL);const ab=await r.arrayBuffer();const d=new Uint8Array(ab);let s='';for(let i=0;i<d.length;i++)s+=String.fromCharCode(d[i]);nes_init();setupInput();nes.loadROM(s);animId=requestAnimationFrame(onFrame);$('#loading').classList.add('hidden');$('#inputStatus').textContent='Ready - Arrows, Z=B, X=A, Enter=Start';window.parent.postMessage({type:'emulator-ready'},'*')}catch(e){$('#loading').innerHTML='<div style="color:#ff6b6b">'+e.message+'</div>';window.parent.postMessage({type:'emulator-error',error:e.message},'*')}}
$('#audioBtn').addEventListener('click',()=>{if(audio_ctx)audio_ctx.resume().then(()=>{audio_started=true;$('#audioBtn').style.display='none'})});
window.addEventListener('message',e=>{if(e.data?.type==='stop'){if(animId)cancelAnimationFrame(animId);if(audio_ctx)audio_ctx.close().catch(()=>{});nes=null}});
start();
</script></body></html>`
  }

  async function cleanupEmulator() {
    if (emulatorIframe.value) {
      try { emulatorIframe.value.contentWindow?.postMessage({ type: 'stop' }, '*') } catch (e) {}
      if (emulatorIframe.value._messageHandler) window.removeEventListener('message', emulatorIframe.value._messageHandler)
      emulatorIframe.value.remove()
      emulatorIframe.value = null
    }
    if (romBlobUrl.value) { URL.revokeObjectURL(romBlobUrl.value); romBlobUrl.value = null }
  }

  async function stopGame(containerElement) {
    await cleanupEmulator()
    gameReady.value = false
  }

  return { runGame, stopGame }
}

