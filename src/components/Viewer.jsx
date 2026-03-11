import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import 'pannellum/build/pannellum.css';
import 'pannellum';

const Viewer = forwardRef(({ image, configUrl, initialYaw, initialPitch, initialHfov, onViewChange, hotSpots = [], navTargets, onNavigate }, ref) => {
  const viewerContainerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const lastReportedRef = useRef({ yaw: initialYaw || 0, pitch: initialPitch || 0, hfov: initialHfov || 100 });
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [imageSettings, setImageSettings] = React.useState({ brightness: 100, contrast: 100, saturation: 100 });
  const [cameraHeight, setCameraHeight] = React.useState(2.5); // Default camera height in meters
  const [showSettings, setShowSettings] = React.useState(false);

  // Sync camera height ref for event handlers
  const cameraHeightRef = useRef(2.5);
  useEffect(() => {
    cameraHeightRef.current = cameraHeight;
  }, [cameraHeight]);

  // Navigation State
  const navArrowRef = useRef(null);
  const [activeNavTarget, setActiveNavTarget] = React.useState(null);
  const navTargetsRef = useRef(navTargets);

  useEffect(() => {
    navTargetsRef.current = navTargets;
  }, [navTargets]);

  // Helper to normalize angle difference
  const getAngleDiff = (a, b) => {
    let diff = a - b;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return diff;
  };

  useImperativeHandle(ref, () => ({
    captureSnapshot: async (metadata) => {
      try {
        if (!viewerInstanceRef.current) return null;
        
        const renderer = viewerInstanceRef.current.getRenderer();
        if (!renderer) return null;
        
        // Pannellum renderer might expose canvas differently depending on version
        const webglCanvas = renderer.getCanvas ? renderer.getCanvas() : (renderer.canvas || null);
        
        if (!webglCanvas) {
           console.warn("Viewer: Could not retrieve canvas for snapshot");
           return null;
        }
        
        // Create a new canvas to compose image + overlay
        const canvas = document.createElement('canvas');
        canvas.width = webglCanvas.width;
        canvas.height = webglCanvas.height;
        const ctx = canvas.getContext('2d');
        
        // Draw the 360 view
        // Note: This requires preserveDrawingBuffer: true in WebGL context if the buffer was cleared
        // If snapshot is black, we might need to force a render or change config
        ctx.drawImage(webglCanvas, 0, 0);
        
        // Draw Overlay
        if (metadata) {
          // Gradient background for text legibility
          const gradient = ctx.createLinearGradient(0, canvas.height - 80, 0, canvas.height);
          gradient.addColorStop(0, 'rgba(0,0,0,0)');
          gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, canvas.height - 100, canvas.width, 100);
          
          ctx.font = 'bold 24px sans-serif';
          ctx.fillStyle = 'white';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          
          const padding = 20;
          const lineHeight = 30;
          
          // Left side: ID and Date
          ctx.fillText(`${metadata.id || 'Unknown ID'}`, padding, canvas.height - padding - lineHeight);
          ctx.font = '18px sans-serif';
          ctx.fillStyle = '#cbd5e1'; // slate-300
          ctx.fillText(`${metadata.date || ''}`, padding, canvas.height - padding);
          
          // Right side: Coordinates
          ctx.textAlign = 'right';
          ctx.font = '18px monospace';
          ctx.fillStyle = '#cbd5e1';
          ctx.fillText(`${metadata.lat?.toFixed(6)}, ${metadata.lon?.toFixed(6)}`, canvas.width - padding, canvas.height - padding);
          
          // Branding (Optional)
          ctx.textAlign = 'right';
          ctx.font = 'bold 16px sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillText('360 WEB MAP', canvas.width - padding, canvas.height - padding - lineHeight - 5);
        }
        
        return canvas.toDataURL('image/jpeg', 0.9);
      } catch (e) {
        console.error("Viewer: Snapshot failed", e);
        return null;
      }
    }
  }));

  // Ref to track active nav target synchronously for event handlers
  const activeNavTargetRef = useRef(null);
  // Ref to track drag state for navigation click prevention
  const dragStartRef = useRef(null);

  // Height Measurement State
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measureStep, setMeasureStep] = useState('idle'); // 'base', 'top', 'done'
  const [measureResult, setMeasureResult] = useState(null); // { height, distance }
  
  // Refs for event handlers to access current state without stale closures
  const isMeasuringRef = useRef(false);
  const measureStepRef = useRef('idle');
  const basePitchRef = useRef(null);
  const baseYawRef = useRef(null); // Added for hotspot placement
  
  // Track measurement hotspots to remove them later
  const measureHotspotsRef = useRef([]);

  // Sync refs with state
  useEffect(() => {
    isMeasuringRef.current = isMeasuring;
    measureStepRef.current = measureStep;
  }, [isMeasuring, measureStep]);

  // Clean up measurement hotspots when result is cleared
  useEffect(() => {
    if (!measureResult && measureHotspotsRef.current.length > 0) {
      if (viewerInstanceRef.current) {
        measureHotspotsRef.current.forEach(id => {
          viewerInstanceRef.current.removeHotSpot(id);
        });
      }
      measureHotspotsRef.current = [];
    }
  }, [measureResult]);

  // --- Callback Refs (for stable listeners) ---
  const onNavigateRef = useRef(onNavigate);
  const onViewChangeRef = useRef(onViewChange);

  useEffect(() => {
    onNavigateRef.current = onNavigate;
    onViewChangeRef.current = onViewChange;
  }, [onNavigate, onViewChange]);




  // Measurement Line State (Ref-based for performance)
  const lineRef = useRef(null);
  const startCircleRef = useRef(null);
  const endCircleRef = useRef(null);
  const svgRef = useRef(null);
  const [displayHeight, setDisplayHeight] = useState(0);
  const [displayDistance, setDisplayDistance] = useState(0);

  useEffect(() => {
    let animationFrame;
    
    if (!measureResult) {
        if (svgRef.current) svgRef.current.style.display = 'none';
        setDisplayHeight(0);
        setDisplayDistance(0);
        return;
    }

    // Initialize counting animation
    const targetHeight = measureResult.height;
    const targetDistance = measureResult.distance;
    const startTime = performance.now();
    const duration = 1000;

    const animateCount = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3); // cubic out
        
        setDisplayHeight(targetHeight * ease);
        setDisplayDistance(targetDistance * ease);
        
        if (progress < 1) {
            requestAnimationFrame(animateCount);
        }
    };
    requestAnimationFrame(animateCount);

    // Initialize SVG visibility
    if (svgRef.current) svgRef.current.style.display = 'block';
    
    // Remove animation class initially
    if (lineRef.current) {
        lineRef.current.classList.remove('animate-draw-line');
        lineRef.current.style.strokeDasharray = 'none';
        lineRef.current.style.strokeDashoffset = '0';
    }

    let isLineInitialized = false;

    const updateLine = () => {
      if (!viewerContainerRef.current) return;

      // Use querySelector to find elements by class since IDs might not be on DOM elements
      const baseEl = document.querySelector('.measure-point-base');
      const topEl = document.querySelector('.measure-point-top');

      if (baseEl && topEl && svgRef.current) {
        const containerRect = viewerContainerRef.current.getBoundingClientRect();
        const baseRect = baseEl.getBoundingClientRect();
        const topRect = topEl.getBoundingClientRect();

        // Check visibility
        const isBaseVisible = window.getComputedStyle(baseEl).visibility !== 'hidden' && baseEl.style.display !== 'none';
        const isTopVisible = window.getComputedStyle(topEl).visibility !== 'hidden' && topEl.style.display !== 'none';

        if (isBaseVisible && isTopVisible) {
          svgRef.current.style.opacity = '1';
          
          const x1 = baseRect.left - containerRect.left + baseRect.width / 2;
          const y1 = baseRect.top - containerRect.top + baseRect.height / 2;
          const x2 = topRect.left - containerRect.left + topRect.width / 2;
          const y2 = topRect.top - containerRect.top + topRect.height / 2;
          
          const length = Math.hypot(x2 - x1, y2 - y1);

          if (lineRef.current) {
              lineRef.current.setAttribute('x1', x1);
              lineRef.current.setAttribute('y1', y1);
              lineRef.current.setAttribute('x2', x2);
              lineRef.current.setAttribute('y2', y2);

              // Initialize animation based on actual length
              if (!isLineInitialized && length > 0) {
                  lineRef.current.style.strokeDasharray = `${length} ${length}`;
                  lineRef.current.style.strokeDashoffset = `${length}`;
                  
                  // Force reflow
                  void lineRef.current.offsetWidth;
                  
                  lineRef.current.classList.add('animate-draw-line');
                  
                  // Reset after animation to prevent gaps during resizing
                  setTimeout(() => {
                      if (lineRef.current) {
                          lineRef.current.style.strokeDasharray = 'none';
                          lineRef.current.style.strokeDashoffset = '0';
                          lineRef.current.classList.remove('animate-draw-line');
                      }
                  }, 800); // slightly longer than 0.6s animation
                  
                  isLineInitialized = true;
              }
          }
          
          if (startCircleRef.current) {
              startCircleRef.current.setAttribute('cx', x1);
              startCircleRef.current.setAttribute('cy', y1);
          }
          
          if (endCircleRef.current) {
              endCircleRef.current.setAttribute('cx', x2);
              endCircleRef.current.setAttribute('cy', y2);
          }

        } else {
          svgRef.current.style.opacity = '0';
        }
      }
      animationFrame = requestAnimationFrame(updateLine);
    };

    updateLine();

    return () => cancelAnimationFrame(animationFrame);
  }, [measureResult]);

  // --- Event Handlers ---
  const handleMouseMove = useCallback((e) => {
    if (!viewerInstanceRef.current || !viewerContainerRef.current) return;
    
    // Navigation: Check for hotspots
    const coords = viewerInstanceRef.current.mouseEventToCoords(e);
    if (!coords) return;
    const [pitch, yaw] = coords;
    
    let hoveredTarget = null;
    if (navTargetsRef.current) {
      for (const target of navTargetsRef.current) {
        // Simple distance check in degrees
        const yawDiff = Math.abs(getAngleDiff(target.yaw, yaw));
        const pitchDiff = Math.abs((target.pitch || 0) - pitch);
        if (yawDiff < 15 && pitchDiff < 30) { // Reduced hit area to 15 deg as requested
           hoveredTarget = target;
           break;
        }
      }
    }
    
    if (hoveredTarget !== activeNavTargetRef.current) {
      activeNavTargetRef.current = hoveredTarget;
      setActiveNavTarget(hoveredTarget);
      
      if (navArrowRef.current) {
        navArrowRef.current.style.opacity = hoveredTarget ? '1' : '0';
      }
    }
    
    if (hoveredTarget && navArrowRef.current) {
       // Position arrow at mouse cursor
       const rect = viewerContainerRef.current.getBoundingClientRect();
       const x = e.clientX - rect.left;
       const y = e.clientY - rect.top;
       navArrowRef.current.style.transform = `translate(${x - 40}px, ${y - 40}px)`;
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    activeNavTargetRef.current = null;
    setActiveNavTarget(null);
    if (navArrowRef.current) navArrowRef.current.style.opacity = '0';
  }, []);

  const handleMouseDown = useCallback((e) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleClick = useCallback((e) => {
    // 1. Check if it was a drag
    if (dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.sqrt(dx*dx + dy*dy) > 5) return;
    }
    
    // 2. Navigation
    if (activeNavTargetRef.current) {
      if (onNavigateRef.current) onNavigateRef.current(activeNavTargetRef.current);
      return;
    }
    
    // 3. Measurement
    if (isMeasuringRef.current && viewerInstanceRef.current) {
       const coords = viewerInstanceRef.current.mouseEventToCoords(e);
       if (!coords) return;
       const [pitch, yaw] = coords;
       
       if (measureStepRef.current === 'base') {
           setMeasureStep('top');
           basePitchRef.current = pitch;
           baseYawRef.current = yaw;
           
           viewerInstanceRef.current.addHotSpot({
               pitch, yaw,
               type: 'info',
               text: 'Base',
               id: 'measure-base',
               cssClass: 'measure-point-base'
           });
           measureHotspotsRef.current.push('measure-base');
       } else if (measureStepRef.current === 'top') {
           setMeasureStep('done');
           
           viewerInstanceRef.current.addHotSpot({
               pitch, yaw,
               type: 'info',
               text: 'Top',
               id: 'measure-top',
               cssClass: 'measure-point-top'
           });
           measureHotspotsRef.current.push('measure-top');
           
           // Calculate height based on camera height assumption
            const h_cam = cameraHeightRef.current;
            const rad = (deg) => deg * Math.PI / 180;
            
            const p_base = basePitchRef.current;
            const p_top = pitch;
            
            let distance = 0;
            let height = 0;
            
            // Only calculate if looking down at the ground for base point
            if (p_base < -0.1) {
                // Distance to the base point projected on ground plane
                // tan(depression) = height_cam / distance
                distance = h_cam / Math.tan(rad(-p_base));
                
                // Calculate height of the object
                // height = distance * (tan(top_angle) - tan(base_angle))
                height = distance * (Math.tan(rad(p_top)) - Math.tan(rad(p_base)));
            }
            
            setMeasureResult({ height: Math.abs(height), distance });
        }
     }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;
    let intervalId = null;
    let resizeObserver = null;

    // Cleanup function for event listeners attached to container
    const cleanupListeners = () => {
      if (viewerContainerRef.current) {
        viewerContainerRef.current.removeEventListener('mousemove', handleMouseMove);
        viewerContainerRef.current.removeEventListener('mouseleave', handleMouseLeave);
        viewerContainerRef.current.removeEventListener('mousedown', handleMouseDown);
        viewerContainerRef.current.removeEventListener('click', handleClick);
      }
    };

    const init = async () => {
      // Destroy existing instance first to be safe
      if (viewerInstanceRef.current) {
        try {
          viewerInstanceRef.current.destroy();
        } catch (e) {
          console.warn("Error destroying previous pannellum instance", e);
        }
        viewerInstanceRef.current = null;
      }

      // Delay init slightly to allow layout to settle
      await new Promise(r => setTimeout(r, 50));
      if (!isMounted) return;

      let config;
      
      // DOUBLE-CHECK: Ensure we have a valid URL for cloud images
      let finalImage = image;
      
      // Always try to resolve relative paths, regardless of configUrl presence
      if (finalImage && !finalImage.startsWith('http')) {
         const baseUrl = import.meta.env.VITE_IMAGE_BASE_URL || import.meta.env.BASE_URL;
         
         if (baseUrl === '/') {
             if (!finalImage.startsWith('/')) {
                 finalImage = `/${finalImage}`;
             }
         } else {
             const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
             if (!finalImage.startsWith(cleanBase)) {
                 const cleanImage = finalImage.startsWith('/') ? finalImage.substring(1) : finalImage;
                 finalImage = `${cleanBase}${cleanImage}`;
             }
         }
         
         console.log('Viewer: Resolved image path:', finalImage);
      }

      // Initialize viewer
      if (configUrl) {
        try {
          const res = await fetch(configUrl);
          if (!isMounted) return;
          if (!res.ok) throw new Error(`Failed to load config: ${res.statusText}`);
          config = await res.json();
          if (!isMounted) return;
          
          console.log('Viewer: Raw config.panorama:', config.panorama);
          console.log('Viewer: BASE_URL:', import.meta.env.BASE_URL);

          // Fix for absolute paths in config.json when deployed to subdirectory
          // Specifically targeting MMS_PIC paths which are known to be in public/MMS_PIC
          if (config.panorama && typeof config.panorama === 'string') {
              const baseUrl = import.meta.env.BASE_URL;
              // Ensure baseUrl is defined and not just '/'
              if (baseUrl && baseUrl !== '/') {
                   const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
                   
                   // Case 1: Starts with /MMS_PIC (Absolute path from root, needs base)
                   if (config.panorama.startsWith('/MMS_PIC')) {
                       config.panorama = `${cleanBase}${config.panorama}`;
                       console.log('Viewer: Fixed absolute path:', config.panorama);
                   }
                   // Case 2: Starts with MMS_PIC (Relative path, needs base/)
                   else if (config.panorama.startsWith('MMS_PIC')) {
                       config.panorama = `${cleanBase}/${config.panorama}`;
                       console.log('Viewer: Fixed relative path:', config.panorama);
                   }
                   // Case 3: Already has base but might be malformed? (Unlikely if logic is correct)
              }
          }
          
          config.autoLoad = true;
          
          // Only set basePath if we haven't converted to an absolute path
          // or if the panorama is relative (not starting with /)
          if (!config.panorama.startsWith('/')) {
              const basePath = configUrl.substring(0, configUrl.lastIndexOf('/') + 1);
              config.basePath = basePath;
              console.log('Viewer: Using basePath:', basePath);
          } else {
              console.log('Viewer: Skipping basePath (panorama is absolute)');
          }

          if (config.multiRes && config.multiRes.fallbackPath) {
              if (config.multiRes.fallbackPath.includes('%s')) {
                   config.multiRes.fallbackPath = config.multiRes.fallbackPath.replace('%s', 'f');
              }
          }
            
          if (!config.haov) config.haov = 360;
          if (!config.vaov) config.vaov = 180;
          if (!config.vOffset) config.vOffset = 0;

          if (hotSpots && hotSpots.length > 0) {
            const processedHotspots = hotSpots.map(hs => ({
                ...hs,
                createTooltipFunc: (hotSpotDiv) => {
                    hotSpotDiv.classList.add(hs.cssClass || 'default-hotspot');
                    if (hs.cssClass === 'flat-cross-marker') {
                        const inner = document.createElement('div');
                        inner.className = 'flat-cross-inner';
                        hotSpotDiv.appendChild(inner);
                    }
                },
                createTooltipArgs: {} 
            }));
            config.hotSpots = [...(config.hotSpots || []), ...processedHotspots];
          }
          
          console.log('Viewer: Resolved config', config);
        } catch (err) {
            console.error("Error loading tile config:", err);
            config = {
                type: 'equirectangular',
                panorama: finalImage,
                autoLoad: true,
            };
        }
      } else {
        config = {
          type: 'equirectangular',
          panorama: finalImage,
          haov: 360,
          vaov: 180,
          vOffset: 0,
          autoLoad: true,
          autoRotate: 0,
          sceneFadeDuration: 0,
          crossOrigin: 'anonymous',
          yaw: initialYaw || 0,
          pitch: initialPitch || 0,
          hfov: initialHfov || 100,
          minHfov: 50,
          maxHfov: 120,
          showZoomCtrl: true,
          showFullscreenCtrl: true,
          compass: false,
          hotSpotDebug: false,
          hotSpots: hotSpots || [],
        };
      }
      
      // Check if container exists before creating viewer
      if (!viewerContainerRef.current) {
          console.warn("Viewer: Container ref missing, aborting init");
          return;
      }

      // Safety timeout
      timeoutId = setTimeout(() => {
          if (viewerInstanceRef.current && isLoading) {
              console.warn("Viewer: Load timeout reached");
              if (isMounted) {
                  setError("Image load timed out");
                  setIsLoading(false);
              }
          }
      }, 30000);

      try {
          viewerInstanceRef.current = window.pannellum.viewer(viewerContainerRef.current, config);
      } catch (initErr) {
          console.error("Pannellum Init Error:", initErr);
          if (isMounted) {
              setError("Failed to initialize viewer");
              setIsLoading(false);
          }
          clearTimeout(timeoutId);
          return;
      }
      
      const updateView = () => {
        if (viewerInstanceRef.current) {
          const yaw = viewerInstanceRef.current.getYaw();
          const pitch = viewerInstanceRef.current.getPitch();
          const hfov = viewerInstanceRef.current.getHfov();
          
          const last = lastReportedRef.current;
          if (
            Math.abs(yaw - last.yaw) > 0.1 || 
            Math.abs(pitch - last.pitch) > 0.1 || 
            Math.abs(hfov - last.hfov) > 0.1
          ) {
            lastReportedRef.current = { yaw, pitch, hfov };
            if (onViewChangeRef.current) onViewChangeRef.current({ yaw, pitch, hfov });
          }
        }
      };
      
      resizeObserver = new ResizeObserver(() => {
          if (viewerInstanceRef.current) {
              viewerInstanceRef.current.resize();
              const renderer = viewerInstanceRef.current.getRenderer();
              if (renderer) {
                  const canvas = renderer.getCanvas();
                  const container = viewerContainerRef.current;
                  if (canvas && container) {
                      const dpr = window.devicePixelRatio || 1;
                      if (Math.abs(canvas.width - container.clientWidth * dpr) > 1 || 
                          Math.abs(canvas.height - container.clientHeight * dpr) > 1) {
                          // console.log('Viewer: Resize triggered for DPR adjustment');
                      }
                  }
              }
          }
      });
      
      if (viewerContainerRef.current) {
          resizeObserver.observe(viewerContainerRef.current);
          viewerContainerRef.current.addEventListener('mousemove', handleMouseMove);
          viewerContainerRef.current.addEventListener('mouseleave', handleMouseLeave);
          viewerContainerRef.current.addEventListener('mousedown', handleMouseDown);
          viewerContainerRef.current.addEventListener('click', handleClick);
      }
      
      viewerInstanceRef.current.on('mouseup', updateView);
      viewerInstanceRef.current.on('zoomchange', updateView);
      viewerInstanceRef.current.on('load', () => {
          console.log('Viewer loaded successfully');
          if (isMounted) {
              setIsLoading(false);
              clearTimeout(timeoutId);
          }
      });
      viewerInstanceRef.current.on('error', (err) => {
          console.error('Pannellum Error:', err);
          if (isMounted) {
              setError("Image not found");
              setIsLoading(false);
              clearTimeout(timeoutId);
          }
      });
      viewerInstanceRef.current.on('loaderror', (err) => {
          console.error('Pannellum Load Error:', err);
          if (isMounted) {
              setError("Failed to load image");
              setIsLoading(false);
              clearTimeout(timeoutId);
          }
      });
      
      intervalId = setInterval(() => {
          updateView();
          if (isLoading && viewerInstanceRef.current && viewerInstanceRef.current.isLoaded()) {
              console.log('Viewer loaded (detected via polling)');
              if (isMounted) {
                  setIsLoading(false);
                  clearTimeout(timeoutId);
              }
          }
      }, 100);
    };

    init();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
      if (resizeObserver) resizeObserver.disconnect();
      cleanupListeners();
      
      if (viewerInstanceRef.current) {
        try {
          // Force aggressive cleanup of WebGL context
          const renderer = viewerInstanceRef.current.getRenderer();
          if (renderer) {
              const gl = renderer.getContext();
              if (gl) {
                  const ext = gl.getExtension('WEBGL_lose_context');
                  if (ext) ext.loseContext();
              }
          }
          viewerInstanceRef.current.destroy();
        } catch (e) {
          console.warn("Error cleaning up viewer:", e);
        }
        viewerInstanceRef.current = null;
      }
    };
  }, [image, configUrl]); // Removed hotSpots from dependency array to prevent reload loop

  return (
    <div className="w-full h-full relative group bg-black">
       <div 
         ref={viewerContainerRef} 
         className={`w-full h-full transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
         style={{ 
             filter: `brightness(${imageSettings.brightness}%) contrast(${imageSettings.contrast}%) saturate(${imageSettings.saturation}%)` 
         }}
       />
       
       {/* Navigation Arrow Overlay */}
       <div 
           ref={navArrowRef}
           className="absolute top-0 left-0 w-[80px] h-[80px] pointer-events-none z-50 transition-opacity duration-200 flex items-center justify-center"
           style={{ 
               opacity: 0, 
               transformOrigin: 'center center',
               filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
               willChange: 'transform, opacity'
           }}
       >
           <svg 
             viewBox="0 0 100 100" 
             className="w-full h-full text-white/90 drop-shadow-md"
             fill="currentColor"
           >
             {/* Google Street View style chevron */}
             <path 
               d="M20 70 L50 40 L80 70 L50 55 Z" 
               fill="white" 
               fillOpacity="0.8" 
               stroke="rgba(0,0,0,0.5)" 
               strokeWidth="2"
               style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
             />
             <path 
               d="M20 50 L50 20 L80 50 L50 35 Z" 
               fill="white" 
               fillOpacity="0.4" 
               stroke="rgba(0,0,0,0.3)" 
               strokeWidth="1"
               style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
             />
           </svg>
       </div>

       {/* Measurement Line Overlay */}
       <svg 
         ref={svgRef}
         className="absolute inset-0 pointer-events-none z-40 transition-opacity duration-200"
         style={{ width: '100%', height: '100%', display: 'none' }}
       >
         <defs>
           <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
             <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="rgba(59, 130, 246, 0.8)"/>
           </filter>
           <linearGradient id="line-gradient" gradientUnits="userSpaceOnUse">
             <stop offset="0%" stopColor="#60a5fa" />
             <stop offset="100%" stopColor="#3b82f6" />
           </linearGradient>
         </defs>
         
         <line 
           ref={lineRef}
           stroke="url(#line-gradient)" 
           strokeWidth="4" 
           strokeDasharray="2000"
           strokeDashoffset="2000"
           className="animate-draw-line"
           strokeLinecap="round"
           filter="url(#shadow)"
         />
         
         <circle 
           ref={startCircleRef}
           r="6"
           fill="#3b82f6"
           stroke="white"
           strokeWidth="2"
           className="animate-pulse"
         />
         
         <circle 
           ref={endCircleRef}
           r="6"
           fill="#3b82f6"
           stroke="white"
           strokeWidth="2"
           className="animate-pulse"
         />
       </svg>

       {/* Tools Toolbar (Settings + Measure) */}
       <div className="absolute top-20 right-4 z-20 flex flex-col items-end gap-2">
           {/* Measure Button */}
           <button 
             onClick={() => {
                 if (isMeasuring) {
                     setIsMeasuring(false);
                     setMeasureStep('idle');
                     setMeasureResult(null);
                 } else {
                     setIsMeasuring(true);
                     setMeasureStep('base');
                     setMeasureResult(null);
                     setShowSettings(false);
                 }
             }}
             className={`p-2 rounded-lg backdrop-blur-sm transition-all shadow-lg border border-white/20 ${isMeasuring ? 'bg-blue-600 text-white' : 'bg-black/60 hover:bg-black/80 text-white'}`}
             title="Measure Height"
           >
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0l12.6 12.6z"></path><path d="m14.5 12.5 2-2"></path><path d="m11.5 9.5 2-2"></path><path d="m8.5 6.5 2-2"></path><path d="m17.5 15.5 2-2"></path></svg>
           </button>

           {/* Settings Button */}
           <button 
             onClick={() => {
                 setShowSettings(!showSettings);
                 if (!showSettings) setIsMeasuring(false);
             }}
             className={`p-2 rounded-lg backdrop-blur-sm transition-all shadow-lg border border-white/20 ${showSettings ? 'bg-blue-600 text-white' : 'bg-black/60 hover:bg-black/80 text-white'}`}
             title="Image Adjustments"
           >
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
           </button>
           
           {showSettings && (
               <div className="bg-black/80 text-white p-4 rounded-xl backdrop-blur-md border border-white/20 w-64 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200">
                   <h3 className="text-sm font-bold mb-4 text-gray-200 flex justify-between items-center">
                       Image Adjustments
                       <button onClick={() => {
                           setImageSettings({ brightness: 100, contrast: 100, saturation: 100 });
                           setCameraHeight(2.5);
                       }} className="text-[10px] text-blue-400 hover:text-blue-300">Reset</button>
                   </h3>
                   
                   <div className="space-y-4">
                       <div className="space-y-1 pb-4 border-b border-white/10">
                           <div className="flex justify-between text-xs text-gray-400 mb-1">
                               <span>Camera Height (m)</span>
                           </div>
                           <input 
                             type="number" 
                             min="0.5" max="10" step="0.1"
                             value={cameraHeight}
                             onChange={(e) => setCameraHeight(parseFloat(e.target.value) || 2.5)}
                             className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                           />
                           <p className="text-[10px] text-gray-500">Height from ground to camera lens</p>
                       </div>

                       <div className="space-y-1">
                           <div className="flex justify-between text-xs text-gray-400">
                               <span>Brightness</span>
                               <span>{imageSettings.brightness}%</span>
                           </div>
                           <input 
                             type="range" 
                             min="50" max="150" 
                             value={imageSettings.brightness}
                             onChange={(e) => setImageSettings(s => ({ ...s, brightness: parseInt(e.target.value) }))}
                             className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                           />
                       </div>
                       
                       <div className="space-y-1">
                           <div className="flex justify-between text-xs text-gray-400">
                               <span>Contrast</span>
                               <span>{imageSettings.contrast}%</span>
                           </div>
                           <input 
                             type="range" 
                             min="50" max="150" 
                             value={imageSettings.contrast}
                             onChange={(e) => setImageSettings(s => ({ ...s, contrast: parseInt(e.target.value) }))}
                             className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                           />
                       </div>

                       <div className="space-y-1">
                           <div className="flex justify-between text-xs text-gray-400">
                               <span>Saturation</span>
                               <span>{imageSettings.saturation}%</span>
                           </div>
                           <input 
                             type="range" 
                             min="0" max="200" 
                             value={imageSettings.saturation}
                             onChange={(e) => setImageSettings(s => ({ ...s, saturation: parseInt(e.target.value) }))}
                             className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                           />
                       </div>
                   </div>
               </div>
           )}
       </div>

       {/* Measurement Overlays */}
       {isMeasuring && (
           <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full backdrop-blur-md border border-white/20 z-30 pointer-events-none shadow-lg animate-in fade-in slide-in-from-top-2">
               <span className="font-medium text-sm flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                   {measureStep === 'base' ? 'Click on the ground at the base' : 'Click on the top of the object'}
               </span>
           </div>
       )}

       {measureResult && (
           <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/80 text-white p-6 rounded-2xl backdrop-blur-md border border-white/20 z-30 shadow-2xl flex flex-col items-center gap-2 animate-in fade-in zoom-in duration-200">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Height Estimate</h3>
               <div className="text-4xl font-bold text-blue-400 font-mono tracking-tight flex items-baseline gap-1">
                   {displayHeight.toFixed(2)} <span className="text-xl text-gray-500 font-sans">m</span>
               </div>
               <div className="text-xs text-gray-400 mt-2 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                   Distance: {displayDistance.toFixed(1)} m
               </div>
               <button 
                 onClick={() => {
                     setMeasureResult(null);
                     setIsMeasuring(false);
                     setMeasureStep('idle');
                 }}
                 className="mt-4 text-xs bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors w-full font-medium"
               >
                   Close Result
               </button>
           </div>
       )}

       {/* Styles for measurement tool */}
       <style>{`
         ${isMeasuring ? '.pnlm-container { cursor: crosshair !important; }' : ''}
         
         @keyframes draw-line {
           to {
             stroke-dashoffset: 0;
           }
         }
         .animate-draw-line {
           animation: draw-line 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
         }
       `}</style>

       {isLoading && !error && (
         <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10 transition-opacity duration-300">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
         </div>
       )}

       {error && (
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-red-400 gap-4 z-20">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
           </svg>
           <p className="text-lg font-medium">{error}</p>
           <p className="text-sm text-gray-500">Check if image exists in folder</p>
         </div>
       )}

       {!image && !configUrl && !isLoading && !error && (
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-gray-500 gap-4">
           <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
           <p className="text-sm font-medium tracking-wide uppercase">Select a point on the map</p>
         </div>
       )}
    </div>
  );
});

export default Viewer;
