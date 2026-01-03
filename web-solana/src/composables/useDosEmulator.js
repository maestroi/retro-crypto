import { ref } from 'vue'

export function useDosEmulator(manifest, fileData, verified, loading, error, gameReady) {
  const dosRuntime = ref(null)
  const dosPromise = ref(null)
  const dosCi = ref(null)
  const dosMainCi = ref(null) // CI returned from main() call
  const emulatorIframe = ref(null) // Iframe for isolation - destroying it fully stops emulator

  // Helper function to load JS-DOS library dynamically with fallback
  // targetWindow is the window context to load into (main window or iframe)
  function loadDosLibrary(targetWindow = window) {
    const targetDocument = targetWindow.document
    
    return new Promise((resolve, reject) => {
      // Check if already loaded in target window
      if (typeof targetWindow.Dos !== 'undefined') {
        resolve(targetWindow.Dos)
        return
      }
      
      // Check if script is already being loaded in target document
      if (targetDocument.querySelector('script[src*="js-dos"]')) {
        // Script tag exists, wait for it to load
        const startTime = Date.now()
        const checkInterval = setInterval(() => {
          if (typeof targetWindow.Dos !== 'undefined') {
            clearInterval(checkInterval)
            resolve(targetWindow.Dos)
          } else if (Date.now() - startTime > 10000) {
            clearInterval(checkInterval)
            reject(new Error('JS-DOS library failed to load from script tag'))
          }
        }, 100)
        return
      }
      
      // Try multiple CDN sources (js-dos.com CDN seems to be down, using jsdelivr as primary)
      const cdnSources = [
        'https://cdn.jsdelivr.net/npm/js-dos@6.22.60/dist/js-dos.js',
        'https://unpkg.com/js-dos@6.22.60/dist/js-dos.js',
        'https://js-dos.com/cdn/6.22/js-dos.js' // Fallback (may be 404)
      ]
      
      let currentIndex = 0
      
      const tryLoadScript = (url) => {
        return new Promise((scriptResolve, scriptReject) => {
          const script = targetDocument.createElement('script')
          script.src = url
          script.async = true
          script.crossOrigin = 'anonymous'
          
          script.onload = () => {
            // Wait for Dos to be available in target window
            const startTime = Date.now()
            const checkInterval = setInterval(() => {
              if (typeof targetWindow.Dos !== 'undefined') {
                clearInterval(checkInterval)
                scriptResolve(targetWindow.Dos)
              } else if (Date.now() - startTime > 5000) {
                clearInterval(checkInterval)
                scriptReject(new Error('JS-DOS library loaded but Dos object not found'))
              }
            }, 50)
          }
          
          script.onerror = () => {
            scriptReject(new Error(`Failed to load from ${url}`))
          }
          
          targetDocument.head.appendChild(script)
        })
      }
      
      // Try loading from each CDN source
      const attemptLoad = async () => {
        if (currentIndex >= cdnSources.length) {
          reject(new Error('Failed to load JS-DOS library from all CDN sources. Please check your internet connection.'))
          return
        }
        
        try {
          const Dos = await tryLoadScript(cdnSources[currentIndex])
          resolve(Dos)
        } catch (err) {
          console.warn(`Failed to load JS-DOS from ${cdnSources[currentIndex]}:`, err.message)
          // Remove failed script
          const failedScript = targetDocument.querySelector(`script[src="${cdnSources[currentIndex]}"]`)
          if (failedScript) {
            failedScript.remove()
          }
          currentIndex++
          attemptLoad()
        }
      }
      
      attemptLoad()
    })
  }

  async function runGame(containerElement) {
    if (!verified.value || !fileData.value || !manifest.value) return

    loading.value = true
    error.value = null

    try {
      // Load JS-DOS library dynamically
      await loadDosLibrary()
      
      // Check if file is a ZIP
      const isZip = manifest.value.filename.toLowerCase().endsWith('.zip') || 
                    (fileData.value.length >= 2 && fileData.value[0] === 0x50 && fileData.value[1] === 0x4B) // PK header

      let gameFiles = {}
      let gameExecutable = null

      if (isZip) {
        // Extract ZIP file
        const JSZip = (await import('jszip')).default
        const zip = await JSZip.loadAsync(fileData.value)
        
        // Extract all files
        const allExecutables = []
        for (const [filename, file] of Object.entries(zip.files)) {
          if (!file.dir) {
            const content = await file.async('uint8array')
            gameFiles[filename] = content
            
            // Collect all executables (.exe, .com, .bat)
            const lowerName = filename.toLowerCase()
            if (lowerName.endsWith('.exe') || lowerName.endsWith('.com') || lowerName.endsWith('.bat')) {
              allExecutables.push(filename)
            }
          }
        }
        
        // Check if manifest specifies the executable (highest priority)
        if (manifest.value.executable) {
          const specifiedExe = manifest.value.executable
          // Check if the specified executable exists in the ZIP
          const foundExe = allExecutables.find(exe => 
            exe.toLowerCase() === specifiedExe.toLowerCase() ||
            exe.toLowerCase().endsWith(specifiedExe.toLowerCase())
          )
          if (foundExe) {
            gameExecutable = foundExe
            console.log(`✓ Using manifest-specified executable: ${gameExecutable}`)
          } else {
            console.warn(`Manifest specifies executable "${specifiedExe}" but it was not found in ZIP. Available:`, allExecutables)
          }
        }
        
        // If no manifest-specified executable, use smart selection
        if (!gameExecutable && allExecutables.length > 0) {
          const manifestName = manifest.value.filename.toLowerCase().replace(/\.zip$/, '')
          const manifestBase = manifestName.replace(/\d+$/, '') // Remove trailing numbers (e.g., "keen1" -> "keen")
          
          // Priority order:
          // 1. Exact match with manifest name (e.g., "keen1.exe" for "keen1.zip")
          // 2. Base name match (e.g., "keen.exe" for "keen1.zip")
          // 3. Common game executable names (not utility files like catalog.exe, setup.exe, etc.)
          // 4. Any other executable
          
          const utilityNames = ['catalog', 'setup', 'install', 'readme', 'help', 'config', 'options']
          
          // Try to find best match
          let bestMatch = null
          let bestScore = -1
          
          for (const exe of allExecutables) {
            const exeLower = exe.toLowerCase().replace(/\.(exe|com|bat)$/, '')
            let score = 0
            
            // Exact match with manifest name (highest priority)
            if (exeLower === manifestName) {
              score = 100
            }
            // Base name match (high priority)
            else if (exeLower === manifestBase || exeLower.startsWith(manifestBase)) {
              score = 80
            }
            // Not a utility file (medium priority)
            else if (!utilityNames.some(util => exeLower.includes(util))) {
              score = 50
            }
            // Utility file (low priority)
            else {
              score = 10
            }
            
            if (score > bestScore) {
              bestScore = score
              bestMatch = exe
            }
          }
          
          gameExecutable = bestMatch || allExecutables[0]
          console.log(`Selected executable: ${gameExecutable} from ${allExecutables.length} candidates:`, allExecutables)
        }
      } else {
        // Single file - treat as game file
        gameFiles[manifest.value.filename] = fileData.value
        gameExecutable = manifest.value.filename
      }

      // Check if we have an IMG file
      const imgFile = Object.keys(gameFiles).find(f => f.toLowerCase().endsWith('.img'))
      
      if (imgFile && !gameExecutable) {
        // For IMG files, set default executable based on filename
        const imgLower = imgFile.toLowerCase()
        if (imgLower.includes('digger')) {
          gameExecutable = 'DIGGER.EXE'
        } else {
          gameExecutable = 'GAME.EXE' // Generic, will be found inside mounted IMG
        }
      }

      if (!gameExecutable) {
        // Try to find any executable
        const exeFiles = Object.keys(gameFiles).filter(f => 
          f.toLowerCase().endsWith('.exe') || 
          f.toLowerCase().endsWith('.com') || 
          f.toLowerCase().endsWith('.bat')
        )
        if (exeFiles.length > 0) {
          gameExecutable = exeFiles[0]
        } else if (!imgFile) {
          throw new Error('No game executable found. ZIP should contain .exe, .com, .bat, or .img files.')
        }
      }

      if (!containerElement) {
        throw new Error('Game container not found')
      }

      // Clear container and any existing iframe
      containerElement.innerHTML = ''
      if (emulatorIframe.value) {
        emulatorIframe.value.remove()
        emulatorIframe.value = null
      }
      
      // Create an iframe to isolate the emulator - destroying it fully stops everything
      const iframe = document.createElement('iframe')
      iframe.id = 'jsdos-iframe'
      iframe.style.width = '100%'
      iframe.style.height = '100%'
      iframe.style.border = 'none'
      iframe.style.display = 'block'
      iframe.style.minHeight = '400px'
      iframe.style.aspectRatio = '4/3'
      iframe.style.backgroundColor = '#000'
      iframe.tabIndex = 0 // Make iframe focusable for keyboard input
      iframe.setAttribute('tabindex', '0')
      
      // Helper function to focus the iframe and its content
      const focusIframe = () => {
        iframe.focus()
        try {
          const iframeWindow = iframe.contentWindow
          const iframeDoc = iframe.contentDocument || iframeWindow?.document
          if (iframeWindow) {
            iframeWindow.focus()
          }
          if (iframeDoc) {
            const canvas = iframeDoc.getElementById('jsdos-canvas')
            if (canvas) {
              canvas.focus()
            }
            // Also focus the body to ensure keyboard events are captured
            if (iframeDoc.body) {
              iframeDoc.body.focus()
            }
          }
        } catch (e) {
          // Cross-origin or not ready yet, ignore
          console.warn('Could not focus iframe content:', e)
        }
      }
      
      // Add click handler to focus the iframe when clicked
      iframe.addEventListener('click', focusIframe)
      
      // Also add mousedown handler (fires before click, better for focus)
      iframe.addEventListener('mousedown', () => {
        focusIframe()
      })
      
      containerElement.appendChild(iframe)
      emulatorIframe.value = iframe
      
      // Wait for iframe to be ready
      await new Promise(resolve => {
        iframe.onload = () => {
          // Focus the iframe and canvas after it loads
          setTimeout(() => {
            try {
              const iframeWindow = iframe.contentWindow
              const iframeDoc = iframe.contentDocument || iframeWindow?.document
              
              if (iframeWindow) {
                iframeWindow.focus()
              }
              iframe.focus()
              
              if (iframeDoc) {
                const canvas = iframeDoc.getElementById('jsdos-canvas')
                if (canvas) {
                  canvas.tabIndex = 0
                  canvas.setAttribute('tabindex', '0')
                  canvas.focus()
                  
                  // Add click and mousedown handlers to canvas for focus
                  canvas.addEventListener('click', () => {
                    canvas.focus()
                    iframeWindow?.focus()
                    iframe.focus()
                  })
                  canvas.addEventListener('mousedown', () => {
                    canvas.focus()
                    iframeWindow?.focus()
                    iframe.focus()
                  })
                }
                
                // Make body focusable and focus it
                if (iframeDoc.body) {
                  iframeDoc.body.tabIndex = 0
                  iframeDoc.body.setAttribute('tabindex', '0')
                }
              }
            } catch (e) {
              // Cross-origin, ignore
              console.warn('Could not focus iframe on load:', e)
            }
          }, 100)
          resolve()
        }
        // Set minimal HTML content for the iframe
        iframe.srcdoc = `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #000; display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden; }
    canvas { width: 100%; height: auto; max-width: 100%; image-rendering: pixelated; display: block; outline: none; }
    canvas:focus { outline: 2px solid rgba(255, 255, 255, 0.3); outline-offset: -2px; }
  </style>
</head>
<body>
  <canvas id="jsdos-canvas" width="640" height="400" tabindex="0"></canvas>
</body>
</html>`
      })
      
      // Get the iframe's window and document
      const iframeWindow = iframe.contentWindow
      const iframeDocument = iframe.contentDocument
      const canvas = iframeDocument.getElementById('jsdos-canvas')
      
      if (!canvas) {
        throw new Error('Failed to create canvas in iframe')
      }
      
      gameReady.value = true
      
      // Load JS-DOS library into the iframe
      console.log('Loading JS-DOS library into iframe...')
      const Dos = await loadDosLibrary(iframeWindow)
      
      console.log('Initializing JS-DOS in iframe, Dos available:', typeof Dos !== 'undefined')
      console.log('Canvas element:', canvas)
      
      // Initialize JS-DOS using Dos API
      // Dos() returns a promise that resolves to a dosbox instance
      // JS-DOS uses a Command Interface (CI) for file operations
      console.log('Dos promise created, waiting for initialization...')
      
      let dosbox
      let ci = null
      
      // Initialize DOS using the .ready() callback pattern
      const initDos = async (options) => {
        console.log('Initializing Dos with canvas element:', canvas)
        
        // JS-DOS uses .ready() callback that provides fs and main
        return new Promise((resolve, reject) => {
          const dosboxPromise = Dos(canvas, options)
          dosPromise.value = dosboxPromise // Store promise for proper termination
          
          dosboxPromise.ready((fs, main) => {
            console.log('JS-DOS ready callback called')
            console.log('fs:', fs)
            console.log('main:', main)
            console.log('fs methods:', fs ? Object.keys(fs) : 'null')
            
            // Store fs and main for later use
            dosbox = { fs, main, ready: dosboxPromise.ready.bind(dosboxPromise) }
            
            // Try to get CI from fs if available
            if (fs && typeof fs.fsWriteFile === 'function') {
              ci = fs
              console.log('Using fs as CI')
            } else if (fs && fs.ci) {
              ci = fs.ci
              console.log('CI found in fs.ci')
            }
            
            resolve({ dosbox, ci, fs, main })
          }).catch((err) => {
            console.error('JS-DOS initialization failed:', err)
            reject(err)
          })
        })
      }
      
      let fs, main
      try {
        // Try official js-dos.com CDN first
        const result = await initDos({
          wdosboxUrl: 'https://js-dos.com/cdn/6.22/wdosbox.js',
          wdosboxWasmUrl: 'https://js-dos.com/cdn/6.22/wdosbox.wasm',
          onprogress: (stage, total, loaded) => {
            console.log(`Loading DOSBox: ${stage} ${loaded}/${total}`)
          }
        })
        dosbox = result.dosbox
        ci = result.ci
        dosCi.value = result.ci // Store CI for termination
        fs = result.fs
        main = result.main
        console.log('Successfully initialized with js-dos.com CDN')
      } catch (err) {
        console.warn('js-dos.com CDN failed, trying unpkg:', err)
        // Fallback to unpkg
        try {
          const result = await initDos({
            wdosboxUrl: 'https://unpkg.com/js-dos@6.22.60/dist/wdosbox.js',
            wdosboxWasmUrl: 'https://unpkg.com/js-dos@6.22.60/dist/wdosbox.wasm',
            onprogress: (stage, total, loaded) => {
              console.log(`Loading DOSBox: ${stage} ${loaded}/${total}`)
            }
          })
          dosbox = result.dosbox
          ci = result.ci
          dosCi.value = result.ci // Store CI for termination
          fs = result.fs
          main = result.main
          console.log('Successfully initialized with unpkg CDN')
        } catch (err2) {
          console.error('Both CDNs failed:', err2)
          throw new Error(`Failed to initialize JS-DOS: ${err2?.message || String(err2)}`)
        }
      }
      
      // Create DOSBox configuration file for better screen resolution and scaling
      const dosboxConfig = `[sdl]
fullscreen=false
fulldouble=false
fullresolution=desktop
windowresolution=1024x768
output=opengl
autolock=true
sensitivity=100
waitonerror=true
priority=higher,normal
mapperfile=mapper-jsdos.map
usescancodes=true

[render]
frameskip=0
aspect=true
scaler=normal3x

[cpu]
core=auto
cputype=auto
cycles=auto
cycleup=10
cycledown=20

[mixer]
nosound=false
rate=22050
blocksize=2048
prebuffer=25

[midi]
mpu401=intelligent
mididevice=default
midiconfig=

[sblaster]
sbtype=sb16
sbbase=220
irq=7
dma=1
hdma=5
sbmixer=true
oplmode=auto
oplemu=default
oplrate=22050

[gus]
gus=false
gusbase=240
gusirq=5
gusdma=3
ultradir=C:\\ULTRASND

[speaker]
pcspeaker=true
pcrate=22050
tandy=auto
tandyrate=22050
disney=true

[joystick]
joysticktype=auto
timed=false
autofire=false
swap34=false
buttonwrap=false

[serial]
serial1=dummy
serial2=dummy
serial3=disabled
serial4=disabled

[parallel]
parallel1=printer
parallel2=disabled
parallel3=disabled

[dos]
xms=true
ems=true
umb=true
keyboardlayout=auto

[ipx]
ipx=false

[autoexec]
# Autoexec commands will be added by the game loading code
`

      // Write DOSBox configuration file for better screen resolution and scaling
      try {
        console.log('Writing DOSBox configuration file...')
        if (fs && typeof fs.createFile === 'function') {
          fs.createFile('dosbox.conf', dosboxConfig)
          console.log('DOSBox config written via fs.createFile')
        } else if (fs && typeof fs.fsWriteFile === 'function') {
          await fs.fsWriteFile('dosbox.conf', dosboxConfig)
          console.log('DOSBox config written via fs.fsWriteFile')
        } else {
          console.warn('Could not write DOSBox config file - using defaults')
        }
      } catch (err) {
        console.warn('Error writing DOSBox config:', err)
        // Continue anyway - DOSBox will use defaults
      }
      
      // Check if we have an IMG file that needs mounting
      if (imgFile) {
        // Handle IMG disk image
        const imgContent = gameFiles[imgFile]
        const imgPath = imgFile.replace(/\\/g, '/').toUpperCase()
        
        console.log('Writing IMG file:', imgPath, 'Size:', imgContent.length)
        
        // Write IMG file to filesystem using fs from .ready() callback
        try {
          if (fs && typeof fs.createFile === 'function') {
            fs.createFile(imgPath, imgContent)
            console.log('IMG file written successfully via fs.createFile')
          } else if (fs && typeof fs.fsWriteFile === 'function') {
            await fs.fsWriteFile(imgPath, imgContent)
            console.log('IMG file written successfully via fs.fsWriteFile')
          } else {
            throw new Error(`No file writing method available for IMG file. fs methods: ${fs ? Object.keys(fs).join(', ') : 'null'}`)
          }
        } catch (err) {
          console.error('Error writing IMG file:', err)
          throw new Error(`Failed to write IMG file: ${err?.message || String(err)}`)
        }
        
        // Create AUTOEXEC.BAT to mount IMG and run executable
        if (!main) {
          throw new Error('main function not available from JS-DOS initialization')
        }
        
        const exeInImg = (gameExecutable.split('/').pop() || gameExecutable.split('\\').pop()).toUpperCase()
        console.log('Creating AUTOEXEC.BAT for IMG execution, executable:', exeInImg)
        
        // Create AUTOEXEC.BAT with mount and run commands
        // Parameters: -size 512,8,2,384 (from DiggerRem instructions)
        // Add resolution/scaler settings at the start
        const batchContent = `@echo off\nconfig -set render scaler normal3x\nconfig -set render aspect true\nimgmount c ${imgPath} -size 512,8,2,384\nc:\n${exeInImg}\n`
        
        // Write AUTOEXEC.BAT using fs
        if (fs && typeof fs.createFile === 'function') {
          fs.createFile('AUTOEXEC.BAT', batchContent)
        } else if (fs && typeof fs.fsWriteFile === 'function') {
          await fs.fsWriteFile('AUTOEXEC.BAT', batchContent)
        } else {
          throw new Error('No file writing method available for AUTOEXEC.BAT')
        }
        
        console.log('Created AUTOEXEC.BAT, calling main() to start DOSBox')
        // Call main() with config file - AUTOEXEC.BAT will set scaler/resolution
        // main() returns a promise that resolves to the Command Interface (CI)
        const mainResult = main(['-conf', 'dosbox.conf', '-c', 'AUTOEXEC.BAT'])
        if (mainResult && typeof mainResult.then === 'function') {
          mainResult.then((ci) => {
            if (ci) {
              dosMainCi.value = ci
              console.log('Captured CI from main() for IMG:', ci)
            }
          }).catch(err => console.warn('Error getting CI from main():', err))
        }
        console.log('Called main() for IMG with config')
      } else {
        // Regular file mounting
        console.log('Mounting regular files, count:', Object.keys(gameFiles).length)
        
        // Mount all game files using Command Interface or dosbox
        for (const [filename, content] of Object.entries(gameFiles)) {
          // Normalize path (use forward slashes, uppercase for DOS)
          const normalizedPath = filename.replace(/\\/g, '/').toUpperCase()
          console.log('Writing file:', normalizedPath, 'Size:', content.length)
          
          try {
            // Use fs from .ready() callback
            if (fs && typeof fs.createFile === 'function') {
              // JS-DOS fs.createFile() method
              fs.createFile(normalizedPath, content)
              console.log('File written via fs.createFile')
            } else if (fs && typeof fs.fsWriteFile === 'function') {
              // CI fsWriteFile method
              await fs.fsWriteFile(normalizedPath, content)
              console.log('File written via fs.fsWriteFile')
            } else {
              throw new Error(`No file writing method available for ${normalizedPath}. fs methods: ${fs ? Object.keys(fs).join(', ') : 'null'}`)
            }
          } catch (err) {
            console.error('Error writing file:', normalizedPath, err)
            throw new Error(`Failed to write file ${normalizedPath}: ${err?.message || String(err)}`)
          }
        }

        // Run the game executable
        const command = gameExecutable.replace(/\\/g, '/').toUpperCase()
        console.log('Running executable:', command)
        
        if (!main) {
          throw new Error('main function not available from JS-DOS initialization')
        }
        
        try {
          // Create AUTOEXEC.BAT to auto-run the game
          // Add resolution/scaler settings at the start for better display
          console.log('Creating AUTOEXEC.BAT with command:', command)
          const batchContent = `@echo off\nconfig -set render scaler normal3x\nconfig -set render aspect true\n${command}\n`
          
          // Write AUTOEXEC.BAT using fs
          if (fs && typeof fs.createFile === 'function') {
            fs.createFile('AUTOEXEC.BAT', batchContent)
          } else if (fs && typeof fs.fsWriteFile === 'function') {
            await fs.fsWriteFile('AUTOEXEC.BAT', batchContent)
          } else {
            throw new Error('No file writing method available for AUTOEXEC.BAT')
          }
          
          console.log('Created AUTOEXEC.BAT, calling main() to start DOSBox')
          // Call main() with config file - AUTOEXEC.BAT will set scaler/resolution
          // main() returns a promise that resolves to the Command Interface (CI)
          const mainResult = main(['-conf', 'dosbox.conf', '-c', 'AUTOEXEC.BAT'])
          if (mainResult && typeof mainResult.then === 'function') {
            mainResult.then((ci) => {
              if (ci) {
                dosMainCi.value = ci
                console.log('Captured CI from main():', ci)
              }
            }).catch(err => console.warn('Error getting CI from main():', err))
          }
          console.log('Called main() - DOSBox should start and run AUTOEXEC.BAT with config')
        } catch (err) {
          console.error('Error running executable:', err)
          throw new Error(`Failed to run executable: ${err?.message || String(err)}`)
        }
      }

      dosRuntime.value = dosbox
      console.log('Game started successfully')
      
      // Focus the iframe and canvas after game starts to capture input
      setTimeout(() => {
        try {
          const iframeWindow = iframe.contentWindow
          const iframeDoc = iframe.contentDocument || iframeWindow?.document
          
          if (iframeWindow) {
            iframeWindow.focus()
          }
          iframe.focus()
          
          if (iframeDoc) {
            const canvas = iframeDoc.getElementById('jsdos-canvas')
            if (canvas) {
              canvas.focus()
            }
            if (iframeDoc.body) {
              iframeDoc.body.focus()
            }
          }
        } catch (e) {
          // Cross-origin, ignore
          console.warn('Could not focus iframe after game start:', e)
        }
      }, 500)

    } catch (err) {
      const errorMsg = err?.message || String(err) || 'Unknown error'
      error.value = `Failed to run game: ${errorMsg}`
      gameReady.value = false
      console.error('Game execution error:', err)
      console.error('Error stack:', err?.stack)
    } finally {
      loading.value = false
    }
  }

  async function stopGame(containerElement) {
    console.log('Stopping game emulation - removing iframe for full cleanup')
    
    // Simply remove the iframe - this fully stops everything (WASM, audio, WebGL)
    // The browser garbage collects all resources when the iframe is destroyed
    if (emulatorIframe.value) {
      console.log('Removing emulator iframe...')
      emulatorIframe.value.remove()
      emulatorIframe.value = null
      console.log('Iframe removed - all emulator resources released')
    }
    
    // Also clear the container as a backup
    if (containerElement) {
      containerElement.innerHTML = ''
    }
    
    // Clear all references to allow garbage collection
    dosPromise.value = null
    dosRuntime.value = null
    dosCi.value = null
    dosMainCi.value = null
    
    // Reset game state
    gameReady.value = false
    
    console.log('Game stopped successfully')
  }

  return {
    runGame,
    stopGame,
    loadDosLibrary
  }
}
