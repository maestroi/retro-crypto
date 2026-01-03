import { ref } from 'vue'

/**
 * Game Boy / Game Boy Color emulator using binjgb
 * Based on https://github.com/binji/binjgb demo.js
 */
export function useGbEmulator(manifest, fileData, verified, loadingRef, errorRef, gameReady) {
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
      const romExtensions = ['.gb', '.gbc', '.sgb']
      
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
        throw new Error('No GB/GBC ROM file found in ZIP')
      }
      
      console.log(`Extracting ROM: ${romFile.name}`)
      const romData = await romFile.file.async('uint8array')
      return { romData, romName: romFile.name }
    } else {
      return { romData: data, romName: manifestData?.filename || 'game.gb' }
    }
  }

  function createEmulatorHtml(romBlobUrl, platform, romName) {
    const isGBC = platform === 'GBC'
    // Create a safe key for localStorage based on ROM name
    const saveKey = 'gb_save_' + romName.replace(/[^a-zA-Z0-9]/g, '_')
    
    // Based on demo.js from https://github.com/binji/binjgb
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      width: 100%; height: 100%; 
      background: #1a1a2e;
      overflow: hidden;
      touch-action: manipulation;
    }
    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding-top: 10px;
      font-family: system-ui, -apple-system, sans-serif;
    }
    #game {
      position: relative;
      background: linear-gradient(145deg, #0f0f23 0%, #1a1a3e 100%);
      border-radius: 12px;
      padding: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    }
    #mainCanvas {
      /* 2.5x scale */
      width: 400px;
      height: 360px;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      display: block;
      border-radius: 4px;
      background: ${isGBC ? '#8bac0f' : '#9bbc0f'};
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
      border-top-color: ${isGBC ? '#87ceeb' : '#9bbc0f'};
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 12px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #error { color: #ff6b6b; text-align: center; padding: 20px; }
    #error.hidden { display: none; }
    #inputStatus { 
      color: #9bbc0f; 
      font-size: 12px; 
      margin-top: 8px; 
      text-align: center;
      min-height: 20px;
    }
    
    /* On-screen controller */
    #controller {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      max-width: 420px;
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
      background: linear-gradient(145deg, #a02828, #801818);
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
      background: linear-gradient(145deg, #c03838, #a02828);
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
    
    @media (max-width: 440px) {
      #mainCanvas { width: 320px; height: 288px; }
      #controller { max-width: 340px; }
    }
  </style>
</head>
<body>
  <div id="game">
    <canvas id="mainCanvas" width="160" height="144">No Canvas Support</canvas>
    <div id="loading">
      <div class="spinner"></div>
      <div id="loadingText">Loading...</div>
    </div>
  </div>
  <div id="error" class="hidden"></div>
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

  <script>
    const ROM_URL = '${romBlobUrl}';
    const SAVE_KEY = '${saveKey}';
    const AUDIO_FRAMES = 4096;
    const AUDIO_LATENCY_SEC = 0.1;
    const MAX_UPDATE_SEC = 5 / 60;
    const CGB_COLOR_CURVE = 2;
    const DEFAULT_PALETTE_IDX = 79;
    const SAVE_INTERVAL_MS = 1000; // Check for save changes every second
    
    const SCREEN_WIDTH = 160;
    const SCREEN_HEIGHT = 144;
    const CPU_TICKS_PER_SECOND = 4194304;
    const EVENT_NEW_FRAME = 1;
    const EVENT_AUDIO_BUFFER_FULL = 2;
    const EVENT_UNTIL_TICKS = 4;
    
    const $ = document.querySelector.bind(document);
    const loadingEl = $('#loading');
    const loadingTextEl = $('#loadingText');
    const errorEl = $('#error');
    const canvas = $('#mainCanvas');
    const inputStatusEl = $('#inputStatus');
    
    let emulator = null;
    let extRamUpdated = false;
    
    function debugLog(msg) {
      console.log('[GB]', msg);
    }
    
    function showError(msg) {
      loadingEl.classList.add('hidden');
      errorEl.textContent = msg;
      errorEl.classList.remove('hidden');
      window.parent.postMessage({ type: 'emulator-error', error: msg }, '*');
    }
    
    function makeWasmBuffer(mod, ptr, size) {
      return new Uint8Array(mod.HEAP8.buffer, ptr, size);
    }
    
    // Audio class from demo.js
    class Audio {
      constructor(module, e) {
        this.module = module;
        this.e = e;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.buffer = makeWasmBuffer(module, module._get_audio_buffer_ptr(e), module._get_audio_buffer_capacity(e));
        this.startSec = 0;
        this.started = false;
        debugLog('Audio ctx sample rate: ' + this.ctx.sampleRate);
      }
      
      get sampleRate() { return this.ctx.sampleRate; }
      
      startPlayback() {
        if (this.started) return;
        this.started = true;
        this.ctx.resume();
        debugLog('Audio started');
      }
      
      pushBuffer() {
        if (!this.started) return;
        const nowSec = this.ctx.currentTime;
        const nowPlusLatency = nowSec + AUDIO_LATENCY_SEC;
        this.startSec = this.startSec || nowPlusLatency;
        
        if (this.startSec >= nowSec) {
          const buffer = this.ctx.createBuffer(2, AUDIO_FRAMES, this.sampleRate);
          const ch0 = buffer.getChannelData(0);
          const ch1 = buffer.getChannelData(1);
          for (let i = 0; i < AUDIO_FRAMES; i++) {
            ch0[i] = this.buffer[2 * i] * 0.5 / 255;
            ch1[i] = this.buffer[2 * i + 1] * 0.5 / 255;
          }
          const src = this.ctx.createBufferSource();
          src.buffer = buffer;
          src.connect(this.ctx.destination);
          src.start(this.startSec);
          this.startSec += AUDIO_FRAMES / this.sampleRate;
        } else {
          this.startSec = nowPlusLatency;
        }
      }
      
      pause() { this.ctx.suspend(); }
      resume() { if (this.started) this.ctx.resume(); }
      destroy() { this.ctx.close().catch(() => {}); }
    }
    
    // Video class
    class Video {
      constructor(module, e, canvas) {
        this.ctx = canvas.getContext('2d');
        this.imageData = this.ctx.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);
        this.buffer = makeWasmBuffer(module, module._get_frame_buffer_ptr(e), module._get_frame_buffer_size(e));
      }
      uploadTexture() { this.imageData.data.set(this.buffer); }
      renderTexture() { this.ctx.putImageData(this.imageData, 0, 0); }
    }
    
    // Emulator class - based on demo.js with joypad callback and save support
    class Emulator {
      constructor(module, romBuffer) {
        this.module = module;
        
        // Get audio sample rate
        const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
        const sampleRate = tempCtx.sampleRate;
        tempCtx.close();
        
        debugLog('Sample rate: ' + sampleRate);
        
        // Align ROM size to 32k
        const size = (romBuffer.byteLength + 0x7fff) & ~0x7fff;
        this.romDataPtr = module._malloc(size);
        makeWasmBuffer(module, this.romDataPtr, size).fill(0).set(new Uint8Array(romBuffer));
        
        // Create emulator
        this.e = module._emulator_new_simple(
          this.romDataPtr, size,
          sampleRate, AUDIO_FRAMES, CGB_COLOR_CURVE
        );
        
        if (this.e === 0) {
          throw new Error('Failed to create emulator');
        }
        
        debugLog('Emulator handle: ' + this.e);
        
        // IMPORTANT: Set up joypad callback (from demo.js Rewind class)
        // This is required for input to work!
        this.joypadBufferPtr = module._joypad_new();
        module._emulator_set_default_joypad_callback(this.e, this.joypadBufferPtr);
        debugLog('Joypad callback set, buffer: ' + this.joypadBufferPtr);
        
        this.audio = new Audio(module, this.e);
        this.video = new Video(module, this.e, canvas);
        
        this.lastRafSec = 0;
        this.leftoverTicks = 0;
        this.rafCancelToken = null;
        this.saveIntervalId = null;
        
        // Set palette
        module._emulator_set_builtin_palette(this.e, DEFAULT_PALETTE_IDX);
        
        // Load existing save if available
        this.loadSave();
        
        // Start auto-save interval
        this.startAutoSave();
        
        this.setupInput();
        debugLog('Emulator ready');
      }
      
      destroy() {
        // Save before destroying
        this.saveGame();
        
        this.stopAutoSave();
        this.cancelAnimationFrame();
        this.audio.destroy();
        this.module._joypad_delete(this.joypadBufferPtr);
        this.module._emulator_delete(this.e);
        this.module._free(this.romDataPtr);
      }
      
      // Helper to work with file data (from demo.js)
      withNewFileData(cb) {
        const fileDataPtr = this.module._ext_ram_file_data_new(this.e);
        const buffer = makeWasmBuffer(
          this.module,
          this.module._get_file_data_ptr(fileDataPtr),
          this.module._get_file_data_size(fileDataPtr)
        );
        const result = cb(fileDataPtr, buffer);
        this.module._file_data_delete(fileDataPtr);
        return result;
      }
      
      // Get external RAM (save data)
      getExtRam() {
        return this.withNewFileData((fileDataPtr, buffer) => {
          this.module._emulator_write_ext_ram(this.e, fileDataPtr);
          return new Uint8Array(buffer);
        });
      }
      
      // Load external RAM (save data)
      loadExtRam(extRamBuffer) {
        this.withNewFileData((fileDataPtr, buffer) => {
          if (buffer.byteLength === extRamBuffer.byteLength) {
            buffer.set(new Uint8Array(extRamBuffer));
            this.module._emulator_read_ext_ram(this.e, fileDataPtr);
            return true;
          }
          return false;
        });
      }
      
      // Save game to localStorage
      saveGame() {
        try {
          const extram = this.getExtRam();
          if (extram && extram.length > 0) {
            // Check if save data is not all zeros (no save)
            const hasData = extram.some(b => b !== 0);
            if (hasData) {
              localStorage.setItem(SAVE_KEY, JSON.stringify(Array.from(extram)));
              debugLog('Game saved (' + extram.length + ' bytes)');
              return true;
            }
          }
        } catch (err) {
          console.error('Failed to save game:', err);
        }
        return false;
      }
      
      // Load save from localStorage
      loadSave() {
        try {
          const savedData = localStorage.getItem(SAVE_KEY);
          if (savedData) {
            const extram = new Uint8Array(JSON.parse(savedData));
            this.loadExtRam(extram);
            debugLog('Save loaded (' + extram.length + ' bytes)');
            inputStatusEl.textContent = 'Save data loaded!';
            setTimeout(() => {
              inputStatusEl.textContent = 'Ready - Arrow keys, Z=B, X=A, Enter=Start, Tab=Select';
            }, 2000);
            return true;
          }
        } catch (err) {
          console.error('Failed to load save:', err);
        }
        return false;
      }
      
      // Start auto-save interval
      startAutoSave() {
        this.saveIntervalId = setInterval(() => {
          // Check if ext RAM was updated
          if (this.module._emulator_was_ext_ram_updated(this.e)) {
            extRamUpdated = true;
          }
          
          if (extRamUpdated) {
            this.saveGame();
            extRamUpdated = false;
          }
        }, SAVE_INTERVAL_MS);
      }
      
      // Stop auto-save interval
      stopAutoSave() {
        if (this.saveIntervalId) {
          clearInterval(this.saveIntervalId);
          this.saveIntervalId = null;
        }
      }
      
      get ticks() {
        return this.module._emulator_get_ticks_f64(this.e);
      }
      
      runUntil(ticks) {
        while (true) {
          const event = this.module._emulator_run_until_f64(this.e, ticks);
          if (event & EVENT_NEW_FRAME) {
            this.video.uploadTexture();
          }
          if (event & EVENT_AUDIO_BUFFER_FULL) {
            this.audio.pushBuffer();
          }
          if (event & EVENT_UNTIL_TICKS) {
            break;
          }
        }
        // Track if ext RAM was updated (for save detection)
        if (this.module._emulator_was_ext_ram_updated(this.e)) {
          extRamUpdated = true;
        }
      }
      
      run() {
        debugLog('Starting main loop');
        this.requestAnimationFrame();
      }
      
      requestAnimationFrame() {
        this.rafCancelToken = requestAnimationFrame(this.rafCallback.bind(this));
      }
      
      cancelAnimationFrame() {
        if (this.rafCancelToken) {
          cancelAnimationFrame(this.rafCancelToken);
          this.rafCancelToken = null;
        }
      }
      
      rafCallback(startMs) {
        this.requestAnimationFrame();
        const startSec = startMs / 1000;
        const deltaSec = Math.max(startSec - (this.lastRafSec || startSec), 0);
        const deltaTicks = Math.min(deltaSec, MAX_UPDATE_SEC) * CPU_TICKS_PER_SECOND;
        const runUntilTicks = this.ticks + deltaTicks - this.leftoverTicks;
        this.runUntil(runUntilTicks);
        this.leftoverTicks = (this.ticks - runUntilTicks) | 0;
        this.lastRafSec = startSec;
        this.video.renderTexture();
      }
      
      setupInput() {
        const mod = this.module;
        const e = this.e;
        const self = this;
        
        // Direct joypad setters from simple.js
        const setJoyp = {
          up: (set) => mod._set_joyp_up(e, set),
          down: (set) => mod._set_joyp_down(e, set),
          left: (set) => mod._set_joyp_left(e, set),
          right: (set) => mod._set_joyp_right(e, set),
          a: (set) => mod._set_joyp_A(e, set),
          b: (set) => mod._set_joyp_B(e, set),
          start: (set) => mod._set_joyp_start(e, set),
          select: (set) => mod._set_joyp_select(e, set),
        };
        
        const pressButton = (btn) => {
          setJoyp[btn](true);
          inputStatusEl.textContent = btn.toUpperCase();
          self.audio.startPlayback();
        };
        
        const releaseButton = (btn) => {
          setJoyp[btn](false);
        };
        
        // Keyboard (from simple.js)
        const keyMap = {
          'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right',
          'KeyX': 'a', 'KeyZ': 'b', 'Enter': 'start',
          'Tab': 'select', 'ShiftLeft': 'select', 'ShiftRight': 'select',
        };
        
        document.addEventListener('keydown', (ev) => {
          const btn = keyMap[ev.code];
          if (btn) { pressButton(btn); ev.preventDefault(); }
        });
        
        document.addEventListener('keyup', (ev) => {
          const btn = keyMap[ev.code];
          if (btn) { releaseButton(btn); ev.preventDefault(); }
        });
        
        // Touch/mouse buttons
        const btnMap = {
          'controller_up': 'up', 'controller_down': 'down',
          'controller_left': 'left', 'controller_right': 'right',
          'controller_a': 'a', 'controller_b': 'b',
          'controller_start': 'start', 'controller_select': 'select'
        };
        
        for (const [id, btn] of Object.entries(btnMap)) {
          const el = document.getElementById(id);
          if (!el) continue;
          
          const down = (ev) => {
            ev.preventDefault();
            pressButton(btn);
            el.classList.add('pressed');
          };
          const up = (ev) => {
            ev.preventDefault();
            releaseButton(btn);
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
    }
    
    async function start() {
      try {
        loadingTextEl.textContent = 'Loading ROM...';
        const response = await fetch(ROM_URL);
        if (!response.ok) throw new Error('Failed to fetch ROM');
        const romBuffer = await response.arrayBuffer();
        debugLog('ROM: ' + romBuffer.byteLength + ' bytes');
        
        loadingTextEl.textContent = 'Loading emulator...';
        
        const module = await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://binji.github.io/binjgb/binjgb.js';
          script.onload = async () => {
            try {
              if (typeof Binjgb !== 'function') throw new Error('Binjgb not found');
              const mod = await Binjgb();
              resolve(mod);
            } catch (err) { reject(err); }
          };
          script.onerror = () => reject(new Error('Failed to load binjgb'));
          document.head.appendChild(script);
          setTimeout(() => reject(new Error('Timeout')), 30000);
        });
        
        debugLog('binjgb loaded');
        loadingTextEl.textContent = 'Starting...';
        
        emulator = new Emulator(module, romBuffer);
        emulator.run();
        
        loadingEl.classList.add('hidden');
        inputStatusEl.textContent = 'Ready - Arrow keys, Z=B, X=A, Enter=Start, Tab=Select';
        
        window.parent.postMessage({ type: 'emulator-ready' }, '*');
        
      } catch (err) {
        console.error(err);
        showError(err.message);
      }
    }
    
    window.addEventListener('message', (ev) => {
      if (ev.data?.type === 'stop' && emulator) {
        // Save game before destroying
        emulator.saveGame();
        emulator.destroy();
        emulator = null;
        debugLog('Emulator stopped and save persisted');
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
      console.log('Starting GB/GBC emulator...')

      const { romData, romName } = await extractRomFromFile(fileData.value, manifest.value)
      console.log(`ROM loaded: ${romName}, size: ${romData.length} bytes`)

      if (!containerElement) {
        throw new Error('Game container not found')
      }

      await cleanupEmulator()

      const blob = new Blob([romData], { type: 'application/octet-stream' })
      romBlobUrl.value = URL.createObjectURL(blob)

      const iframe = document.createElement('iframe')
      iframe.id = 'gb-emulator-iframe'
      iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;min-height:580px;background:#1a1a2e;'
      iframe.setAttribute('allow', 'autoplay')
      
      containerElement.appendChild(iframe)
      emulatorIframe.value = iframe

      const messageHandler = (event) => {
        if (!iframe.contentWindow || event.source !== iframe.contentWindow) return
        
        if (event.data.type === 'emulator-ready') {
          console.log('GB emulator ready')
          gameReady.value = true
          if (loadingRef && typeof loadingRef === 'object') {
            loadingRef.value = false
          }
        } else if (event.data.type === 'emulator-error') {
          console.error('GB emulator error:', event.data.error)
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

      const platform = manifest.value.platform || 'GB'
      iframe.srcdoc = createEmulatorHtml(romBlobUrl.value, platform, romName)

    } catch (err) {
      console.error('GB emulator error:', err)
      if (errorRef && typeof errorRef === 'object') {
        errorRef.value = `Failed to run GB/GBC game: ${err.message}`
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
    console.log('Stopping GB emulator')
    await cleanupEmulator()
    gameReady.value = false
  }

  return {
    runGame,
    stopGame
  }
}
