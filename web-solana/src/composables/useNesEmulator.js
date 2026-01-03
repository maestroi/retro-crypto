import { ref } from 'vue'

/**
 * NES emulator using JSNES
 * Based on https://github.com/bfirsh/jsnes
 */
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
          const runJsonText = await zip.files['run.json'].async('string')
          const runJson = JSON.parse(runJsonText)
          if (runJson.rom) romFilename = runJson.rom
          else if (runJson.executable) romFilename = runJson.executable
        } catch (e) {
          console.warn('Failed to parse run.json:', e)
        }
      }
      
      let romFile = null
      const romExtensions = ['.nes']
      
      for (const [filename, file] of Object.entries(zip.files)) {
        if (file.dir) continue
        const lowerName = filename.toLowerCase()
        
        if (romFilename && (lowerName === romFilename.toLowerCase() || 
            filename.toLowerCase().endsWith(romFilename.toLowerCase()))) {
          romFile = { name: filename, file }
          break
        }
        
        if (romExtensions.some(ext => lowerName.endsWith(ext))) {
          romFile = { name: filename, file }
          if (!romFilename) break
        }
      }
      
      if (!romFile) {
        throw new Error('No NES ROM file found in ZIP')
      }
      
      console.log(`Extracting ROM: ${romFile.name}`)
      const romData = await romFile.file.async('uint8array')
      return { romData, romName: romFile.name }
    } else {
      return { romData: data, romName: manifestData?.filename || 'game.nes' }
    }
  }

  function createEmulatorHtml(romBlobUrl, romName) {
    // Create a safe key for localStorage based on ROM name
    const saveKey = 'nes_save_' + romName.replace(/[^a-zA-Z0-9]/g, '_')
    
    // Based on JSNES embedding example
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      width: 100%; 
      min-height: 100%;
      background: #1a1a2e;
      overflow-x: hidden;
      overflow-y: auto;
      touch-action: manipulation;
    }
    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 10px 10px 30px 10px;
      font-family: system-ui, -apple-system, sans-serif;
    }
    #game {
      position: relative;
      background: linear-gradient(145deg, #0f0f23 0%, #1a1a3e 100%);
      border-radius: 12px;
      padding: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    }
    #nes-canvas {
      /* 2x scale (256x240 -> 512x480) */
      width: 512px;
      height: 480px;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      display: block;
      border-radius: 4px;
      background: #000;
    }
    #loading {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      color: #fff;
      text-align: center;
      z-index: 10;
    }
    #loading.hidden { display: none; }
    .spinner {
      width: 40px; height: 40px;
      border: 3px solid rgba(255,255,255,0.3);
      border-top-color: #e74c3c;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 12px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #error { color: #ff6b6b; text-align: center; padding: 20px; }
    #error.hidden { display: none; }
    #inputStatus { 
      color: #e74c3c; 
      font-size: 12px; 
      margin-top: 8px; 
      text-align: center;
      min-height: 20px;
    }
    #audioBtn {
      display: none;
      margin-top: 10px;
      padding: 10px 20px;
      background: #e74c3c;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    }
    #audioBtn:hover {
      background: #c0392b;
    }
    
    /* On-screen controller */
    #controller {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      max-width: 520px;
      margin-top: 12px;
      padding: 0 15px;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
    }
    #controller_dpad {
      position: relative;
      width: 120px; height: 120px;
    }
    #controller_dpad > div {
      position: absolute;
      width: 40px; height: 40px;
      background: linear-gradient(145deg, #3a3a5a, #2a2a4a);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #888;
      font-size: 18px;
      cursor: pointer;
      transition: all 0.05s;
    }
    #controller_dpad > div:active, #controller_dpad > div.pressed {
      background: linear-gradient(145deg, #6a6a8a, #5a5a7a);
      color: #fff;
      transform: scale(0.95);
    }
    #controller_up { top: 0; left: 40px; }
    #controller_down { bottom: 0; left: 40px; }
    #controller_left { top: 40px; left: 0; }
    #controller_right { top: 40px; right: 0; }
    
    .buttons-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .ab-row {
      display: flex;
      gap: 20px;
    }
    .roundBtn {
      width: 56px; height: 56px;
      border-radius: 50%;
      background: linear-gradient(145deg, #e74c3c, #c0392b);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #eee;
      font-weight: bold;
      font-size: 18px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.5);
      cursor: pointer;
      transition: all 0.05s;
    }
    .roundBtn:active, .roundBtn.pressed {
      background: linear-gradient(145deg, #ff6b6b, #e74c3c);
      transform: scale(0.92);
      box-shadow: 0 2px 4px rgba(0,0,0,0.5);
    }
    .system-row {
      display: flex;
      gap: 20px;
    }
    .capsuleBtn {
      width: 55px; height: 20px;
      border-radius: 10px;
      background: #3a3a5a;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #888;
      font-size: 10px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.05s;
    }
    .capsuleBtn:active, .capsuleBtn.pressed {
      background: #6a6a8a;
      color: #fff;
    }
    
    @media (max-width: 540px) {
      #nes-canvas { width: 100%; height: auto; max-width: 512px; }
      #controller { max-width: 100%; }
    }
  </style>
</head>
<body>
  <div id="game">
    <canvas id="nes-canvas" width="256" height="240">No Canvas Support</canvas>
    <div id="loading">
      <div class="spinner"></div>
      <div id="loadingText">Loading...</div>
    </div>
  </div>
  <div id="error" class="hidden"></div>
  <button id="audioBtn">Click to enable audio</button>
  <div id="inputStatus"></div>
  
  <div id="controller">
    <div id="controller_dpad">
      <div id="controller_up">▲</div>
      <div id="controller_down">▼</div>
      <div id="controller_left">◀</div>
      <div id="controller_right">▶</div>
    </div>
    <div class="buttons-area">
      <div class="ab-row">
        <div id="controller_b" class="roundBtn">B</div>
        <div id="controller_a" class="roundBtn">A</div>
      </div>
      <div class="system-row">
        <div id="controller_select" class="capsuleBtn">SELECT</div>
        <div id="controller_start" class="capsuleBtn">START</div>
      </div>
    </div>
  </div>

  <script src="https://unpkg.com/jsnes/dist/jsnes.min.js"></script>
  <script>
    const ROM_URL = '${romBlobUrl}';
    const SAVE_KEY = '${saveKey}';
    
    const SCREEN_WIDTH = 256;
    const SCREEN_HEIGHT = 240;
    const FRAMEBUFFER_SIZE = SCREEN_WIDTH * SCREEN_HEIGHT;

    const AUDIO_BUFFERING = 512;
    const SAMPLE_COUNT = 4 * 1024;
    const SAMPLE_MASK = SAMPLE_COUNT - 1;
    
    const $ = document.querySelector.bind(document);
    const loadingEl = $('#loading');
    const loadingTextEl = $('#loadingText');
    const errorEl = $('#error');
    const canvas = $('#nes-canvas');
    const inputStatusEl = $('#inputStatus');
    const audioBtn = $('#audioBtn');
    
    let canvas_ctx, image;
    let framebuffer_u8, framebuffer_u32;
    let audio_samples_L = new Float32Array(SAMPLE_COUNT);
    let audio_samples_R = new Float32Array(SAMPLE_COUNT);
    let audio_write_cursor = 0, audio_read_cursor = 0;
    let audio_started = false;
    let audio_ctx;
    let nes = null;
    let animationId = null;
    
    function debugLog(msg) {
      console.log('[NES]', msg);
    }
    
    function showError(msg) {
      loadingEl.classList.add('hidden');
      errorEl.textContent = msg;
      errorEl.classList.remove('hidden');
      window.parent.postMessage({ type: 'emulator-error', error: msg }, '*');
    }
    
    function audio_remain() {
      return (audio_write_cursor - audio_read_cursor) & SAMPLE_MASK;
    }
    
    function audio_callback(event) {
      if (!nes) return;
      
      const dst = event.outputBuffer;
      const len = dst.length;
      
      // Attempt to avoid buffer underruns
      if (audio_remain() < AUDIO_BUFFERING && nes) {
        nes.frame();
      }
      
      const dst_l = dst.getChannelData(0);
      const dst_r = dst.getChannelData(1);
      for (let i = 0; i < len; i++) {
        const src_idx = (audio_read_cursor + i) & SAMPLE_MASK;
        dst_l[i] = audio_samples_L[src_idx];
        dst_r[i] = audio_samples_R[src_idx];
      }
      
      audio_read_cursor = (audio_read_cursor + len) & SAMPLE_MASK;
    }
    
    function onAnimationFrame() {
      animationId = window.requestAnimationFrame(onAnimationFrame);
      if (!nes) return;
      
      if (!audio_started) {
        nes.frame();
      }
      
      image.data.set(framebuffer_u8);
      canvas_ctx.putImageData(image, 0, 0);
    }
    
    function setupInput() {
      const keyMap = {
        38: jsnes.Controller.BUTTON_UP,    // Up arrow
        40: jsnes.Controller.BUTTON_DOWN,  // Down arrow
        37: jsnes.Controller.BUTTON_LEFT,  // Left arrow
        39: jsnes.Controller.BUTTON_RIGHT, // Right arrow
        88: jsnes.Controller.BUTTON_A,     // X
        90: jsnes.Controller.BUTTON_B,     // Z
        65: jsnes.Controller.BUTTON_A,     // A
        83: jsnes.Controller.BUTTON_B,     // S
        81: jsnes.Controller.BUTTON_A,     // Q (azerty)
        79: jsnes.Controller.BUTTON_B,     // O (dvorak)
        9:  jsnes.Controller.BUTTON_SELECT, // Tab
        13: jsnes.Controller.BUTTON_START   // Enter
      };
      
      const buttonNames = {
        [jsnes.Controller.BUTTON_UP]: 'UP',
        [jsnes.Controller.BUTTON_DOWN]: 'DOWN',
        [jsnes.Controller.BUTTON_LEFT]: 'LEFT',
        [jsnes.Controller.BUTTON_RIGHT]: 'RIGHT',
        [jsnes.Controller.BUTTON_A]: 'A',
        [jsnes.Controller.BUTTON_B]: 'B',
        [jsnes.Controller.BUTTON_SELECT]: 'SELECT',
        [jsnes.Controller.BUTTON_START]: 'START'
      };
      
      document.addEventListener('keydown', (event) => {
        const button = keyMap[event.keyCode];
        if (button !== undefined && nes) {
          event.preventDefault();
          nes.buttonDown(1, button);
          inputStatusEl.textContent = buttonNames[button] || '';
          
          // Start audio on first input
          if (audio_ctx && audio_ctx.state === 'suspended') {
            audio_ctx.resume().then(() => {
              audio_started = true;
              audioBtn.style.display = 'none';
            });
          }
        }
      });
      
      document.addEventListener('keyup', (event) => {
        const button = keyMap[event.keyCode];
        if (button !== undefined && nes) {
          event.preventDefault();
          nes.buttonUp(1, button);
        }
      });
      
      // Touch/mouse buttons
      const btnMap = {
        'controller_up': jsnes.Controller.BUTTON_UP,
        'controller_down': jsnes.Controller.BUTTON_DOWN,
        'controller_left': jsnes.Controller.BUTTON_LEFT,
        'controller_right': jsnes.Controller.BUTTON_RIGHT,
        'controller_a': jsnes.Controller.BUTTON_A,
        'controller_b': jsnes.Controller.BUTTON_B,
        'controller_start': jsnes.Controller.BUTTON_START,
        'controller_select': jsnes.Controller.BUTTON_SELECT
      };
      
      for (const [id, button] of Object.entries(btnMap)) {
        const el = document.getElementById(id);
        if (!el) continue;
        
        const down = (ev) => {
          ev.preventDefault();
          if (nes) {
            nes.buttonDown(1, button);
            inputStatusEl.textContent = buttonNames[button] || '';
            
            // Start audio on first input
            if (audio_ctx && audio_ctx.state === 'suspended') {
              audio_ctx.resume().then(() => {
                audio_started = true;
                audioBtn.style.display = 'none';
              });
            }
          }
          el.classList.add('pressed');
        };
        const up = (ev) => {
          ev.preventDefault();
          if (nes) {
            nes.buttonUp(1, button);
          }
          el.classList.remove('pressed');
        };
        
        el.addEventListener('touchstart', down, { passive: false });
        el.addEventListener('touchend', up, { passive: false });
        el.addEventListener('touchcancel', up, { passive: false });
        el.addEventListener('mousedown', down);
        el.addEventListener('mouseup', up);
        el.addEventListener('mouseleave', up);
      }
      
      debugLog('Input handlers bound');
    }
    
    function nes_init() {
      canvas_ctx = canvas.getContext('2d');
      image = canvas_ctx.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);
      
      canvas_ctx.fillStyle = 'black';
      canvas_ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      
      // Allocate framebuffer array
      const buffer = new ArrayBuffer(image.data.length);
      framebuffer_u8 = new Uint8ClampedArray(buffer);
      framebuffer_u32 = new Uint32Array(buffer);
      
      // Setup audio
      audio_ctx = new (window.AudioContext || window.webkitAudioContext)();
      const script_processor = audio_ctx.createScriptProcessor(AUDIO_BUFFERING, 0, 2);
      script_processor.onaudioprocess = audio_callback;
      script_processor.connect(audio_ctx.destination);
      
      if (audio_ctx.state === 'suspended') {
        audioBtn.style.display = 'block';
      } else {
        audio_started = true;
      }
      
      // Create NES emulator
      nes = new jsnes.NES({
        onFrame: function(framebuffer_24) {
          for (let i = 0; i < FRAMEBUFFER_SIZE; i++) {
            framebuffer_u32[i] = 0xFF000000 | framebuffer_24[i];
          }
        },
        onAudioSample: function(l, r) {
          audio_samples_L[audio_write_cursor] = l;
          audio_samples_R[audio_write_cursor] = r;
          audio_write_cursor = (audio_write_cursor + 1) & SAMPLE_MASK;
        }
      });
      
      debugLog('NES emulator initialized');
    }
    
    function nes_boot(rom_data) {
      nes.loadROM(rom_data);
      animationId = window.requestAnimationFrame(onAnimationFrame);
      debugLog('ROM loaded and running');
    }
    
    async function start() {
      try {
        loadingTextEl.textContent = 'Loading ROM...';
        
        const response = await fetch(ROM_URL);
        if (!response.ok) throw new Error('Failed to fetch ROM');
        
        // For NES ROMs, we need to read as binary string
        const arrayBuffer = await response.arrayBuffer();
        const romData = new Uint8Array(arrayBuffer);
        
        // Convert to string format that JSNES expects
        let rom_str = '';
        for (let i = 0; i < romData.length; i++) {
          rom_str += String.fromCharCode(romData[i]);
        }
        
        debugLog('ROM loaded: ' + romData.length + ' bytes');
        
        loadingTextEl.textContent = 'Starting emulator...';
        
        nes_init();
        setupInput();
        nes_boot(rom_str);
        
        loadingEl.classList.add('hidden');
        inputStatusEl.textContent = 'Ready - Arrows, Z=B, X=A, Enter=Start, Tab=Select';
        
        window.parent.postMessage({ type: 'emulator-ready' }, '*');
        
      } catch (err) {
        console.error(err);
        showError(err.message);
      }
    }
    
    // Audio enable button handler
    audioBtn.addEventListener('click', () => {
      if (audio_ctx) {
        audio_ctx.resume().then(() => {
          audio_started = true;
          audioBtn.style.display = 'none';
        });
      }
    });
    
    // Stop handler
    window.addEventListener('message', (ev) => {
      if (ev.data?.type === 'stop') {
        if (animationId) {
          cancelAnimationFrame(animationId);
          animationId = null;
        }
        if (audio_ctx) {
          audio_ctx.close().catch(() => {});
        }
        nes = null;
        debugLog('Emulator stopped');
      }
    });
    
    start();
  </script>
</body>
</html>`;
  }

  async function runGame(containerElement) {
    if (!verified.value || !fileData.value || !manifest.value) {
      if (errorRef && typeof errorRef === 'object') {
        errorRef.value = 'Game not verified or file data missing'
      }
      return
    }

    if (loadingRef && typeof loadingRef === 'object') {
      loadingRef.value = true
    }
    
    try {
      console.log('Starting NES emulator...')

      const { romData, romName } = await extractRomFromFile(fileData.value, manifest.value)
      console.log(`ROM loaded: ${romName}, size: ${romData.length} bytes`)

      if (!containerElement) {
        throw new Error('Game container not found')
      }

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
        if (!iframe.contentWindow || event.source !== iframe.contentWindow) return
        
        if (event.data.type === 'emulator-ready') {
          console.log('NES emulator ready')
          gameReady.value = true
          if (loadingRef && typeof loadingRef === 'object') {
            loadingRef.value = false
          }
        } else if (event.data.type === 'emulator-error') {
          console.error('NES emulator error:', event.data.error)
          if (errorRef && typeof errorRef === 'object') {
            errorRef.value = `Emulator error: ${event.data.error}`
          }
          gameReady.value = false
          if (loadingRef && typeof loadingRef === 'object') {
            loadingRef.value = false
          }
        }
      }
      window.addEventListener('message', messageHandler)
      iframe._messageHandler = messageHandler

      iframe.srcdoc = createEmulatorHtml(romBlobUrl.value, romName)

    } catch (err) {
      console.error('NES emulator error:', err)
      if (errorRef && typeof errorRef === 'object') {
        errorRef.value = `Failed to run NES game: ${err.message}`
      }
      gameReady.value = false
      if (loadingRef && typeof loadingRef === 'object') {
        loadingRef.value = false
      }
    }
  }

  async function cleanupEmulator() {
    if (emulatorIframe.value) {
      try {
        emulatorIframe.value.contentWindow?.postMessage({ type: 'stop' }, '*')
      } catch (e) {}
      
      if (emulatorIframe.value._messageHandler) {
        window.removeEventListener('message', emulatorIframe.value._messageHandler)
      }
      
      emulatorIframe.value.remove()
      emulatorIframe.value = null
    }
    
    if (romBlobUrl.value) {
      URL.revokeObjectURL(romBlobUrl.value)
      romBlobUrl.value = null
    }
  }

  async function stopGame(containerElement) {
    console.log('Stopping NES emulator')
    await cleanupEmulator()
    gameReady.value = false
  }

  return {
    runGame,
    stopGame
  }
}

