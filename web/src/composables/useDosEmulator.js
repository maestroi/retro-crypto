import { ref } from 'vue'

export function useDosEmulator(manifest, fileData, verified, loading, error, gameReady) {
  const dosRuntime = ref(null)
  const dosPromise = ref(null)
  const dosCi = ref(null)
  const dosMainCi = ref(null)
  const emulatorIframe = ref(null)

  function loadDosLibrary(targetWindow = window) {
    const targetDocument = targetWindow.document
    
    const validateDos = (Dos) => {
      if (typeof Dos !== 'function') {
        console.warn('Dos is not a function:', typeof Dos, Dos)
        return false
      }
      return true
    }
    
    return new Promise((resolve, reject) => {
      if (typeof targetWindow.Dos !== 'undefined') {
        if (validateDos(targetWindow.Dos)) {
          console.log('JS-DOS already loaded in target window')
          resolve(targetWindow.Dos)
          return
        } else {
          console.warn('Dos exists but is not valid, will try to reload')
          delete targetWindow.Dos
        }
      }
      
      const existingScript = targetDocument.querySelector('script[src*="js-dos"]')
      if (existingScript) {
        console.log('Removing existing JS-DOS script tag to reload fresh')
        existingScript.remove()
      }
      
      // Try multiple CDN sources with more fallbacks
      const cdnSources = [
        'https://cdn.jsdelivr.net/npm/js-dos@6.22.60/dist/js-dos.js',
        'https://unpkg.com/js-dos@6.22.60/dist/js-dos.js',
        'https://js-dos.com/cdn/6.22/js-dos.js'
      ]
      
      let currentIndex = 0
      
      const tryLoadScript = (url) => {
        return new Promise((scriptResolve, scriptReject) => {
          const script = targetDocument.createElement('script')
          script.src = url
          script.async = true
          script.crossOrigin = 'anonymous'
          
          const timeoutId = setTimeout(() => {
            scriptReject(new Error(`Timeout loading from ${url}`))
          }, 15000)
          
          script.onload = () => {
            const startTime = Date.now()
            const checkInterval = setInterval(() => {
              if (typeof targetWindow.Dos !== 'undefined') {
                clearInterval(checkInterval)
                clearTimeout(timeoutId)
                if (validateDos(targetWindow.Dos)) {
                  console.log(`JS-DOS loaded successfully from ${url}`)
                  scriptResolve(targetWindow.Dos)
                } else {
                  scriptReject(new Error('Dos loaded but is not a valid function'))
                }
              } else if (Date.now() - startTime > 10000) {
                clearInterval(checkInterval)
                clearTimeout(timeoutId)
                scriptReject(new Error('JS-DOS library loaded but Dos object not found after 10s'))
              }
            }, 100)
          }
          
          script.onerror = (e) => {
            clearTimeout(timeoutId)
            scriptReject(new Error(`Failed to load from ${url}: ${e?.message || 'network error'}`))
          }
          
          targetDocument.head.appendChild(script)
        })
      }
      
      const attemptLoad = async () => {
        if (currentIndex >= cdnSources.length) {
          reject(new Error('Failed to load JS-DOS library from all CDN sources. Please check your internet connection and try refreshing the page.'))
          return
        }
        
        try {
          const Dos = await tryLoadScript(cdnSources[currentIndex])
          resolve(Dos)
        } catch (err) {
          console.warn(`Failed to load JS-DOS from ${cdnSources[currentIndex]}:`, err.message)
          const failedScript = targetDocument.querySelector(`script[src="${cdnSources[currentIndex]}"]`)
          if (failedScript) {
            failedScript.remove()
          }
          if (targetWindow.Dos) {
            delete targetWindow.Dos
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
      await loadDosLibrary()
      
      const isZip = manifest.value.filename.toLowerCase().endsWith('.zip') || 
                    (fileData.value.length >= 2 && fileData.value[0] === 0x50 && fileData.value[1] === 0x4B)

      let gameFiles = {}
      let gameExecutable = null

      if (isZip) {
        const JSZip = (await import('jszip')).default
        const zip = await JSZip.loadAsync(fileData.value)
        
        const allExecutables = []
        for (const [filename, file] of Object.entries(zip.files)) {
          if (!file.dir) {
            const content = await file.async('uint8array')
            gameFiles[filename] = content
            
            const lowerName = filename.toLowerCase()
            if (lowerName.endsWith('.exe') || lowerName.endsWith('.com') || lowerName.endsWith('.bat')) {
              allExecutables.push(filename)
            }
          }
        }
        
        if (manifest.value.executable) {
          const specifiedExe = manifest.value.executable
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
        
        if (!gameExecutable && allExecutables.length > 0) {
          const manifestName = manifest.value.filename.toLowerCase().replace(/\.zip$/, '')
          const manifestBase = manifestName.replace(/\d+$/, '')
          
          const utilityNames = ['catalog', 'setup', 'install', 'readme', 'help', 'config', 'options']
          
          let bestMatch = null
          let bestScore = -1
          
          for (const exe of allExecutables) {
            const exeLower = exe.toLowerCase().replace(/\.(exe|com|bat)$/, '')
            let score = 0
            
            if (exeLower === manifestName) {
              score = 100
            } else if (exeLower === manifestBase || exeLower.startsWith(manifestBase)) {
              score = 80
            } else if (!utilityNames.some(util => exeLower.includes(util))) {
              score = 50
            } else {
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
        gameFiles[manifest.value.filename] = fileData.value
        gameExecutable = manifest.value.filename
      }

      const imgFile = Object.keys(gameFiles).find(f => f.toLowerCase().endsWith('.img'))
      
      if (imgFile && !gameExecutable) {
        const imgLower = imgFile.toLowerCase()
        if (imgLower.includes('digger')) {
          gameExecutable = 'DIGGER.EXE'
        } else {
          gameExecutable = 'GAME.EXE'
        }
      }

      if (!gameExecutable) {
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

      containerElement.innerHTML = ''
      if (emulatorIframe.value) {
        emulatorIframe.value.remove()
        emulatorIframe.value = null
      }
      
      const iframe = document.createElement('iframe')
      iframe.id = 'jsdos-iframe'
      iframe.style.width = '100%'
      iframe.style.height = '100%'
      iframe.style.border = 'none'
      iframe.style.display = 'block'
      iframe.style.minHeight = '400px'
      iframe.style.aspectRatio = '4/3'
      iframe.style.backgroundColor = '#000'
      iframe.tabIndex = 0
      iframe.setAttribute('tabindex', '0')
      
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
            if (iframeDoc.body) {
              iframeDoc.body.focus()
            }
          }
        } catch (e) {
          console.warn('Could not focus iframe content:', e)
        }
      }
      
      iframe.addEventListener('click', focusIframe)
      iframe.addEventListener('mousedown', () => { focusIframe() })
      
      containerElement.appendChild(iframe)
      emulatorIframe.value = iframe
      
      await new Promise(resolve => {
        iframe.onload = () => {
          setTimeout(() => {
            try {
              const iframeWindow = iframe.contentWindow
              const iframeDoc = iframe.contentDocument || iframeWindow?.document
              
              if (iframeWindow) iframeWindow.focus()
              iframe.focus()
              
              if (iframeDoc) {
                const canvas = iframeDoc.getElementById('jsdos-canvas')
                if (canvas) {
                  canvas.tabIndex = 0
                  canvas.setAttribute('tabindex', '0')
                  canvas.focus()
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
                if (iframeDoc.body) {
                  iframeDoc.body.tabIndex = 0
                  iframeDoc.body.setAttribute('tabindex', '0')
                }
              }
            } catch (e) {
              console.warn('Could not focus iframe on load:', e)
            }
          }, 100)
          resolve()
        }
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
      
      const iframeWindow = iframe.contentWindow
      const iframeDocument = iframe.contentDocument
      const canvas = iframeDocument.getElementById('jsdos-canvas')
      
      if (!canvas) {
        throw new Error('Failed to create canvas in iframe')
      }
      
      gameReady.value = true
      
      console.log('Loading JS-DOS library into iframe...')
      const Dos = await loadDosLibrary(iframeWindow)
      
      console.log('Initializing JS-DOS in iframe, Dos available:', typeof Dos !== 'undefined')
      
      let dosbox
      let ci = null
      
      const initDos = async (options) => {
        console.log('Initializing Dos with canvas element:', canvas)
        
        if (!canvas || !canvas.parentElement) {
          throw new Error('Canvas element is no longer in the DOM')
        }
        
        if (typeof Dos !== 'function') {
          throw new Error('Dos is not a function - JS-DOS may not have loaded correctly')
        }
        
        return new Promise((resolve, reject) => {
          let dosboxPromise
          
          try {
            dosboxPromise = Dos(canvas, options)
          } catch (dosInitErr) {
            console.error('Dos() threw an error:', dosInitErr)
            reject(new Error(`Dos initialization error: ${dosInitErr?.message || String(dosInitErr)}`))
            return
          }
          
          if (!dosboxPromise) {
            reject(new Error('Dos() returned null or undefined'))
            return
          }
          
          if (typeof dosboxPromise.ready !== 'function') {
            console.error('dosboxPromise does not have ready() method:', dosboxPromise)
            reject(new Error('Dos() did not return a valid JS-DOS instance (missing ready method)'))
            return
          }
          
          dosPromise.value = dosboxPromise
          
          dosboxPromise.ready((fs, main) => {
            console.log('JS-DOS ready callback called')
            console.log('fs:', fs)
            console.log('main:', main)
            
            dosbox = { fs, main, ready: dosboxPromise.ready.bind(dosboxPromise) }
            
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
      
      // CDN configurations to try in order - more fallbacks
      const cdnConfigs = [
        {
          name: 'jsdelivr',
          wdosboxUrl: 'https://cdn.jsdelivr.net/npm/js-dos@6.22.60/dist/wdosbox.js',
          wdosboxWasmUrl: 'https://cdn.jsdelivr.net/npm/js-dos@6.22.60/dist/wdosbox.wasm'
        },
        {
          name: 'unpkg',
          wdosboxUrl: 'https://unpkg.com/js-dos@6.22.60/dist/wdosbox.js',
          wdosboxWasmUrl: 'https://unpkg.com/js-dos@6.22.60/dist/wdosbox.wasm'
        },
        {
          name: 'js-dos.com',
          wdosboxUrl: 'https://js-dos.com/cdn/6.22/wdosbox.js',
          wdosboxWasmUrl: 'https://js-dos.com/cdn/6.22/wdosbox.wasm'
        }
      ]
      
      let lastError = null
      let initialized = false
      
      for (const cdn of cdnConfigs) {
        if (!canvas || !canvas.parentElement || !emulatorIframe.value) {
          throw new Error('Emulator was stopped during initialization')
        }
        
        try {
          console.log(`Trying to initialize JS-DOS with ${cdn.name} CDN...`)
          const result = await initDos({
            wdosboxUrl: cdn.wdosboxUrl,
            wdosboxWasmUrl: cdn.wdosboxWasmUrl,
            onprogress: (stage, total, loaded) => {
              console.log(`Loading DOSBox (${cdn.name}): ${stage} ${loaded}/${total}`)
            }
          })
          dosbox = result.dosbox
          ci = result.ci
          dosCi.value = result.ci
          fs = result.fs
          main = result.main
          console.log(`Successfully initialized with ${cdn.name} CDN`)
          initialized = true
          break
        } catch (err) {
          console.warn(`${cdn.name} CDN failed:`, err?.message || err)
          lastError = err
        }
      }
      
      if (!initialized) {
        throw new Error(`Failed to initialize JS-DOS after trying all CDNs. Last error: ${lastError?.message || String(lastError)}`)
      }
      
      // DOSBox configuration
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

[dos]
xms=true
ems=true
umb=true
keyboardlayout=auto

[autoexec]
`

      try {
        console.log('Writing DOSBox configuration file...')
        if (fs && typeof fs.createFile === 'function') {
          fs.createFile('dosbox.conf', dosboxConfig)
        } else if (fs && typeof fs.fsWriteFile === 'function') {
          await fs.fsWriteFile('dosbox.conf', dosboxConfig)
        }
      } catch (err) {
        console.warn('Error writing DOSBox config:', err)
      }
      
      if (imgFile) {
        const imgContent = gameFiles[imgFile]
        const imgPath = imgFile.replace(/\\/g, '/').toUpperCase()
        
        console.log('Writing IMG file:', imgPath, 'Size:', imgContent.length)
        
        try {
          if (fs && typeof fs.createFile === 'function') {
            fs.createFile(imgPath, imgContent)
          } else if (fs && typeof fs.fsWriteFile === 'function') {
            await fs.fsWriteFile(imgPath, imgContent)
          } else {
            throw new Error('No file writing method available for IMG file')
          }
        } catch (err) {
          console.error('Error writing IMG file:', err)
          throw new Error(`Failed to write IMG file: ${err?.message || String(err)}`)
        }
        
        if (!main) {
          throw new Error('main function not available from JS-DOS initialization')
        }
        
        const exeInImg = (gameExecutable.split('/').pop() || gameExecutable.split('\\').pop()).toUpperCase()
        
        const batchContent = `@echo off\nconfig -set render scaler normal3x\nconfig -set render aspect true\nimgmount c ${imgPath} -size 512,8,2,384\nc:\n${exeInImg}\n`
        
        if (fs && typeof fs.createFile === 'function') {
          fs.createFile('AUTOEXEC.BAT', batchContent)
        } else if (fs && typeof fs.fsWriteFile === 'function') {
          await fs.fsWriteFile('AUTOEXEC.BAT', batchContent)
        }
        
        const mainResult = main(['-conf', 'dosbox.conf', '-c', 'AUTOEXEC.BAT'])
        if (mainResult && typeof mainResult.then === 'function') {
          mainResult.then((ci) => {
            if (ci) {
              dosMainCi.value = ci
            }
          }).catch(err => console.warn('Error getting CI from main():', err))
        }
      } else {
        console.log('Mounting regular files, count:', Object.keys(gameFiles).length)
        
        for (const [filename, content] of Object.entries(gameFiles)) {
          const normalizedPath = filename.replace(/\\/g, '/').toUpperCase()
          console.log('Writing file:', normalizedPath, 'Size:', content.length)
          
          try {
            if (fs && typeof fs.createFile === 'function') {
              fs.createFile(normalizedPath, content)
            } else if (fs && typeof fs.fsWriteFile === 'function') {
              await fs.fsWriteFile(normalizedPath, content)
            } else {
              throw new Error(`No file writing method available for ${normalizedPath}`)
            }
          } catch (err) {
            console.error('Error writing file:', normalizedPath, err)
            throw new Error(`Failed to write file ${normalizedPath}: ${err?.message || String(err)}`)
          }
        }

        const command = gameExecutable.replace(/\\/g, '/').toUpperCase()
        console.log('Running executable:', command)
        
        if (!main) {
          throw new Error('main function not available from JS-DOS initialization')
        }
        
        const batchContent = `@echo off\nconfig -set render scaler normal3x\nconfig -set render aspect true\n${command}\n`
        
        if (fs && typeof fs.createFile === 'function') {
          fs.createFile('AUTOEXEC.BAT', batchContent)
        } else if (fs && typeof fs.fsWriteFile === 'function') {
          await fs.fsWriteFile('AUTOEXEC.BAT', batchContent)
        }
        
        const mainResult = main(['-conf', 'dosbox.conf', '-c', 'AUTOEXEC.BAT'])
        if (mainResult && typeof mainResult.then === 'function') {
          mainResult.then((ci) => {
            if (ci) {
              dosMainCi.value = ci
            }
          }).catch(err => console.warn('Error getting CI from main():', err))
        }
      }

      dosRuntime.value = dosbox
      console.log('Game started successfully')
      
      setTimeout(() => {
        try {
          const iframeWindow = iframe.contentWindow
          const iframeDoc = iframe.contentDocument || iframeWindow?.document
          
          if (iframeWindow) iframeWindow.focus()
          iframe.focus()
          
          if (iframeDoc) {
            const canvas = iframeDoc.getElementById('jsdos-canvas')
            if (canvas) canvas.focus()
            if (iframeDoc.body) iframeDoc.body.focus()
          }
        } catch (e) {
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
    
    if (emulatorIframe.value) {
      console.log('Removing emulator iframe...')
      emulatorIframe.value.remove()
      emulatorIframe.value = null
      console.log('Iframe removed - all emulator resources released')
    }
    
    if (containerElement) {
      containerElement.innerHTML = ''
    }
    
    dosPromise.value = null
    dosRuntime.value = null
    dosCi.value = null
    dosMainCi.value = null
    
    gameReady.value = false
    
    console.log('Game stopped successfully')
  }

  return {
    runGame,
    stopGame,
    loadDosLibrary
  }
}
