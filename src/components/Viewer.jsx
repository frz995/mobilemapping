import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { MapPin, Ruler, X, Check, Wrench, ChevronRight, ChevronDown } from 'lucide-react';

// GPU Texture Cache Map
const textureCache = new Map();
const MAX_CACHE_SIZE = 12;

function loadGpuTexture(url) {
  if (!url) return Promise.reject(new Error("No URL provided"));
  if (textureCache.has(url)) {
    return Promise.resolve(textureCache.get(url));
  }
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        
        if (textureCache.size >= MAX_CACHE_SIZE) {
          const oldestKey = textureCache.keys().next().value;
          const oldTex = textureCache.get(oldestKey);
          if (oldTex) oldTex.dispose();
          textureCache.delete(oldestKey);
        }
        textureCache.set(url, tex);
        resolve(tex);
      },
      undefined,
      (err) => reject(err)
    );
  });
}

const getAngleDiff = (a, b) => {
  let diff = a - b;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
};

const Viewer = forwardRef(({ 
  image, 
  configUrl, 
  initialYaw = 0, 
  initialPitch = 0, 
  initialHfov = 100, 
  onViewChange, 
  hotSpots = [], 
  navTargets = [], 
  onNavigate 
}, ref) => {
  const containerRef = useRef(null);
  
  // Three.js Core Refs
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const meshCurrentRef = useRef(null);
  const meshTargetRef = useRef(null);
  const materialCurrentRef = useRef(null);
  const materialTargetRef = useRef(null);
  const animFrameIdRef = useRef(null);
  
  // Navigation & Digitized Groups
  const groundArrowsGroupRef = useRef(null);
  const digitizedMarkersGroupRef = useRef(null);
  
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  
  // Camera Rotation State
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const cameraAngleRef = useRef({
    yaw: initialYaw || 0,
    pitch: initialPitch || 0,
    fov: initialHfov || 75,
    targetYaw: initialYaw || 0,
    targetPitch: initialPitch || 0,
    targetFov: initialHfov || 75
  });

  // UI & Tool States
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageSettings, setImageSettings] = useState({ brightness: 100, contrast: 100, saturation: 100 });
  const [activeHoverArrow, setActiveHoverArrow] = useState(null);
  const [isFlying, setIsFlying] = useState(false);

  // Advanced WebGIS Tools State
  const [activeTool, setActiveTool] = useState(null); // 'digitize' | '3d-measure'
  const [showToolbox, setShowToolbox] = useState(false);

  // Asset Digitizer Modal State
  const [pendingAssetPoint, setPendingAssetPoint] = useState(null);
  const [assetCategory, setAssetCategory] = useState('Traffic Sign');
  const [assetCondition, setAssetCondition] = useState('Good');
  const [assetNotes, setAssetNotes] = useState('');
  const [digitizedAssets, setDigitizedAssets] = useState([]);

  // 3D Distance Measurement State
  const [p1Point, setP1Point] = useState(null);
  const [p2Point, setP2Point] = useState(null);
  const [distanceResult, setDistanceResult] = useState(null);

  // Callback Refs
  const onViewChangeRef = useRef(onViewChange);
  const onNavigateRef = useRef(onNavigate);
  const navTargetsRef = useRef(navTargets);

  useEffect(() => {
    onViewChangeRef.current = onViewChange;
    onNavigateRef.current = onNavigate;
    navTargetsRef.current = navTargets;
  }, [onViewChange, onNavigate, navTargets]);

  // Imperative Snapshot Capture
  useImperativeHandle(ref, () => ({
    captureSnapshot: async (metadata) => {
      try {
        if (!rendererRef.current) return null;
        const webglCanvas = rendererRef.current.domElement;
        if (!webglCanvas) return null;
        
        const canvas = document.createElement('canvas');
        canvas.width = webglCanvas.width;
        canvas.height = webglCanvas.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(webglCanvas, 0, 0);
        
        if (metadata) {
          const gradient = ctx.createLinearGradient(0, canvas.height - 80, 0, canvas.height);
          gradient.addColorStop(0, 'rgba(0,0,0,0)');
          gradient.addColorStop(1, 'rgba(0,0,0,0.85)');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, canvas.height - 100, canvas.width, 100);
          
          ctx.font = 'bold 24px sans-serif';
          ctx.fillStyle = 'white';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          
          const padding = 20;
          const lineHeight = 30;
          
          ctx.fillText(`${metadata.id || 'Unknown ID'}`, padding, canvas.height - padding - lineHeight);
          ctx.font = '18px sans-serif';
          ctx.fillStyle = '#cbd5e1';
          ctx.fillText(`${metadata.date || ''}`, padding, canvas.height - padding);
          
          ctx.textAlign = 'right';
          ctx.font = '18px monospace';
          ctx.fillStyle = '#cbd5e1';
          ctx.fillText(`${metadata.lat?.toFixed(6)}, ${metadata.lon?.toFixed(6)}`, canvas.width - padding, canvas.height - padding);
          
          ctx.textAlign = 'right';
          ctx.font = 'bold 16px sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillText('MOBILE MAPPING WEBGIS', canvas.width - padding, canvas.height - padding - lineHeight - 5);
        }
        
        return canvas.toDataURL('image/jpeg', 0.9);
      } catch (e) {
        console.error("Viewer: Snapshot failed", e);
        return null;
      }
    }
  }));

  // Resolve image URL
  const resolvePanoramaUrl = useCallback(async (rawImage, rawConfigUrl) => {
    if (rawConfigUrl) {
      try {
        const res = await fetch(rawConfigUrl);
        if (res.ok) {
          const cfg = await res.json();
          if (cfg.multiRes && cfg.multiRes.fallbackPath) {
            const basePath = rawConfigUrl.substring(0, rawConfigUrl.lastIndexOf('/') + 1);
            const fallbackFile = cfg.multiRes.fallbackPath.replace('%s', 'f');
            return `${basePath}${fallbackFile}`;
          } else if (cfg.panorama) {
            let pano = cfg.panorama;
            if (!pano.startsWith('http') && !pano.startsWith('/')) {
              const basePath = rawConfigUrl.substring(0, rawConfigUrl.lastIndexOf('/') + 1);
              pano = `${basePath}${pano}`;
            }
            return pano;
          }
        }
      } catch (err) {
        console.warn("Viewer: Config URL fetch failed:", err);
      }
    }
    
    let url = rawImage;
    if (url && typeof url === 'string') {
      if (url.startsWith('/http')) url = url.substring(1);
      if (url.startsWith('http')) {
        url = encodeURI(decodeURI(url));
      } else {
        const baseUrl = import.meta.env.VITE_IMAGE_BASE_URL || import.meta.env.BASE_URL || '/';
        const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
        if (!url.startsWith(cleanBase)) {
          url = `${cleanBase}${url.startsWith('/') ? url.substring(1) : url}`;
        }
      }
    }
    return url;
  }, []);

  // Update Three.js camera position & orientation
  const applyCameraMatrix = useCallback(() => {
    if (!cameraRef.current) return;
    const angles = cameraAngleRef.current;
    
    const phi = THREE.MathUtils.degToRad(90 - angles.pitch);
    const theta = THREE.MathUtils.degToRad(angles.yaw);
    
    const target = new THREE.Vector3();
    target.x = 500 * Math.sin(phi) * Math.cos(theta);
    target.y = 500 * Math.cos(phi);
    target.z = 500 * Math.sin(phi) * Math.sin(theta);
    
    cameraRef.current.lookAt(target);
    cameraRef.current.fov = angles.fov;
    cameraRef.current.updateProjectionMatrix();

    if (onViewChangeRef.current) {
      onViewChangeRef.current({ yaw: angles.yaw, pitch: angles.pitch, hfov: angles.fov });
    }
  }, []);

  // Update Ground 3D Navigation Arrows Mesh Group
  const updateGroundArrows = useCallback(() => {
    if (!groundArrowsGroupRef.current) return;
    const group = groundArrowsGroupRef.current;
    
    while (group.children.length > 0) {
      const child = group.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      group.remove(child);
    }
    
    const targets = navTargetsRef.current || [];
    if (targets.length === 0) return;

    targets.forEach((target, index) => {
      if (!target) return;
      
      const arrowGroup = new THREE.Group();
      arrowGroup.userData = { target, isForward: index === 0 };
      
      const shape = new THREE.Shape();
      shape.moveTo(0, 8);
      shape.lineTo(6, -4);
      shape.lineTo(3, -4);
      shape.lineTo(0, 0);
      shape.lineTo(-3, -4);
      shape.lineTo(-6, -4);
      shape.closePath();
      
      const extrudeSettings = { depth: 1.5, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.5, bevelThickness: 0.5 };
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geometry.rotateX(-Math.PI / 2);
      
      const material = new THREE.MeshBasicMaterial({
        color: index === 0 ? 0x3b82f6 : 0x94a3b8,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      arrowGroup.add(mesh);
      
      const radYaw = THREE.MathUtils.degToRad(target.yaw || 0);
      const radius = 25;
      arrowGroup.position.set(radius * Math.sin(radYaw), -22, -radius * Math.cos(radYaw));
      arrowGroup.rotation.y = -radYaw;
      
      group.add(arrowGroup);
    });
  }, []);

  // Initialize Three.js WebGL Scene & 60 FPS Damping Loop
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(initialHfov || 75, width / height, 0.1, 1000);
    camera.position.set(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // 2. Dual-Sphere Meshes
    const sphereGeo = new THREE.SphereGeometry(500, 60, 40);
    sphereGeo.scale(-1, 1, 1);

    const matCurrent = new THREE.MeshBasicMaterial({ transparent: true, opacity: 1.0, side: THREE.DoubleSide });
    const matTarget = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, side: THREE.DoubleSide });
    materialCurrentRef.current = matCurrent;
    materialTargetRef.current = matTarget;

    const meshCurrent = new THREE.Mesh(sphereGeo, matCurrent);
    const meshTarget = new THREE.Mesh(sphereGeo.clone(), matTarget);
    scene.add(meshCurrent);
    scene.add(meshTarget);

    // 3. Ground 3D Navigation & Digitized Markers Group
    const arrowsGroup = new THREE.Group();
    scene.add(arrowsGroup);
    groundArrowsGroupRef.current = arrowsGroup;

    const digitizedGroup = new THREE.Group();
    scene.add(digitizedGroup);
    digitizedMarkersGroupRef.current = digitizedGroup;

    // 4. Smooth 60 FPS Animation Loop
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      
      const angles = cameraAngleRef.current;

      const dampingFactor = 0.18;
      const yawDiff = getAngleDiff(angles.targetYaw, angles.yaw);
      angles.yaw += yawDiff * dampingFactor;
      
      angles.targetPitch = Math.max(-85, Math.min(85, angles.targetPitch));
      angles.pitch += (angles.targetPitch - angles.pitch) * dampingFactor;
      
      angles.targetFov = Math.max(30, Math.min(110, angles.targetFov));
      angles.fov += (angles.targetFov - angles.fov) * dampingFactor;

      applyCameraMatrix();

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // 5. Resize Observer
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      resizeObserver.disconnect();
      if (rendererRef.current && rendererRef.current.domElement) {
        container.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
      sphereGeo.dispose();
      matCurrent.dispose();
      matTarget.dispose();
    };
  }, [applyCameraMatrix]);

  // Update Ground Arrows when targets update
  useEffect(() => {
    updateGroundArrows();
  }, [navTargets, updateGroundArrows]);

  // Main Panorama Load & Dual-Buffer Transition Effect
  useEffect(() => {
    let isCancelled = false;

    const loadAndTransition = async () => {
      try {
        const url = await resolvePanoramaUrl(image, configUrl);
        if (!url || isCancelled) return;

        const targetTexture = await loadGpuTexture(url);
        if (isCancelled) return;

        if (!materialCurrentRef.current.map) {
          materialCurrentRef.current.map = targetTexture;
          materialCurrentRef.current.needsUpdate = true;
          
          cameraAngleRef.current.yaw = initialYaw || 0;
          cameraAngleRef.current.targetYaw = initialYaw || 0;
          cameraAngleRef.current.pitch = initialPitch || 0;
          cameraAngleRef.current.targetPitch = initialPitch || 0;
          
          setIsLoading(false);
          setError(null);
          return;
        }

        materialTargetRef.current.map = targetTexture;
        materialTargetRef.current.opacity = 0.0;
        materialTargetRef.current.needsUpdate = true;

        setIsFlying(true);
        const duration = 700;
        const startTime = performance.now();
        const startYaw = cameraAngleRef.current.targetYaw;
        const targetYaw = initialYaw !== undefined ? initialYaw : startYaw;
        const startFov = cameraAngleRef.current.targetFov;

        const animateTransition = (now) => {
          if (isCancelled) return;
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1.0);
          
          const easeProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

          materialCurrentRef.current.opacity = 1.0 - easeProgress;
          materialTargetRef.current.opacity = easeProgress;

          cameraAngleRef.current.targetYaw = startYaw + getAngleDiff(targetYaw, startYaw) * easeProgress;
          cameraAngleRef.current.targetFov = startFov - Math.sin(progress * Math.PI) * 12;
          
          if (cameraRef.current) {
            cameraRef.current.position.z = -Math.sin(progress * Math.PI) * 10;
          }

          if (progress < 1.0) {
            requestAnimationFrame(animateTransition);
          } else {
            materialCurrentRef.current.map = targetTexture;
            materialCurrentRef.current.opacity = 1.0;
            materialCurrentRef.current.needsUpdate = true;
            materialTargetRef.current.opacity = 0.0;
            
            if (cameraRef.current) {
              cameraRef.current.position.set(0, 0, 0);
            }
            cameraAngleRef.current.targetFov = startFov;
            setIsFlying(false);

            setIsLoading(false);
            setError(null);
          }
        };

        requestAnimationFrame(animateTransition);
      } catch (err) {
        console.error("Viewer: Failed to load panorama texture:", err);
        if (!isCancelled) {
          setError("Failed to load 360° imagery");
          setIsLoading(false);
          setIsFlying(false);
        }
      }
    };

    loadAndTransition();

    return () => {
      isCancelled = true;
    };
  }, [image, configUrl, initialYaw, resolvePanoramaUrl]);

  // Pointer Handlers
  const handlePointerDown = useCallback((e) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX || e.touches?.[0]?.clientX || 0, y: e.clientY || e.touches?.[0]?.clientY || 0 };
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;
    
    const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
    const clientY = e.clientY || e.touches?.[0]?.clientY || 0;

    // Raycasting for 3D ground arrows hover
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    
    if (groundArrowsGroupRef.current) {
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(groundArrowsGroupRef.current.children, true);
      
      if (intersects.length > 0) {
        let topGroup = intersects[0].object;
        while (topGroup.parent && topGroup.parent !== groundArrowsGroupRef.current) {
          topGroup = topGroup.parent;
        }
        if (topGroup.userData && topGroup.userData.target) {
          containerRef.current.style.cursor = 'pointer';
          setActiveHoverArrow(topGroup.userData.target);
          return;
        }
      } else {
        containerRef.current.style.cursor = activeTool ? 'crosshair' : (isDraggingRef.current ? 'grabbing' : 'default');
        setActiveHoverArrow(null);
      }
    }

    if (!isDraggingRef.current) return;
    
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;
    dragStartRef.current = { x: clientX, y: clientY };

    const angles = cameraAngleRef.current;
    const currentFov = angles.targetFov || 75;
    const fovFactor = currentFov / 75.0;
    const sensitivity = 0.11 * fovFactor;

    const deltaYaw = dx * sensitivity;
    const deltaPitch = dy * sensitivity;
    
    angles.targetYaw -= deltaYaw;
    angles.targetPitch += deltaPitch;
  }, [activeTool]);

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const zoomSensitivity = 0.04;
    cameraAngleRef.current.targetFov += e.deltaY * zoomSensitivity;
  }, []);

  // Handle Tool Click Intersections (Digitizer & 3D Measurements)
  const handleClick = useCallback((e) => {
    if (activeHoverArrow && onNavigateRef.current) {
      onNavigateRef.current(activeHoverArrow);
      return;
    }

    if (!activeTool || !cameraRef.current) return;

    // Raycast on 360 sphere
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const pointWorld = new THREE.Vector3();
    raycasterRef.current.ray.at(100, pointWorld);

    // Compute Pitch & Yaw of clicked point
    const r = pointWorld.length();
    const pitch = THREE.MathUtils.radToDeg(Math.asin(pointWorld.y / r));
    const yaw = THREE.MathUtils.radToDeg(Math.atan2(pointWorld.z, pointWorld.x));

    if (activeTool === 'digitize') {
      setPendingAssetPoint({ pitch, yaw, x: pointWorld.x, y: pointWorld.y, z: pointWorld.z });
    } else if (activeTool === '3d-measure') {
      if (!p1Point) {
        setP1Point({ x: pointWorld.x, y: pointWorld.y, z: pointWorld.z });
      } else if (!p2Point) {
        const p2 = { x: pointWorld.x, y: pointWorld.y, z: pointWorld.z };
        setP2Point(p2);

        // Compute 3D Euclidean distance
        const dx = p2.x - p1Point.x;
        const dy = p2.y - p1Point.y;
        const dz = p2.z - p1Point.z;
        const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz) * 0.1; // Scale factor
        const horizontalSpan = Math.sqrt(dx * dx + dz * dz) * 0.1;
        const verticalClearance = Math.abs(dy) * 0.1;

        setDistanceResult({
          distance3D: dist3D.toFixed(2),
          horizontalSpan: horizontalSpan.toFixed(2),
          verticalClearance: verticalClearance.toFixed(2)
        });
      }
    }
  }, [activeHoverArrow, activeTool, p1Point, p2Point]);

  // Save Digitized Asset
  const handleSaveAsset = () => {
    if (!pendingAssetPoint) return;
    const newAsset = {
      id: `asset_${Date.now()}`,
      category: assetCategory,
      condition: assetCondition,
      notes: assetNotes,
      pitch: pendingAssetPoint.pitch,
      yaw: pendingAssetPoint.yaw
    };

    setDigitizedAssets(prev => [...prev, newAsset]);

    // Add 3D Pin Mesh to scene
    if (digitizedMarkersGroupRef.current) {
      const pinGeo = new THREE.SphereGeometry(2, 16, 16);
      const pinMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.set(pendingAssetPoint.x, pendingAssetPoint.y, pendingAssetPoint.z);
      digitizedMarkersGroupRef.current.add(pinMesh);
    }

    setPendingAssetPoint(null);
    setAssetNotes('');
  };

  return (
    <div className="w-full h-full relative group bg-black overflow-hidden select-none">
       {/* Three.js WebGL Container */}
       <div 
         ref={containerRef} 
         onMouseDown={handlePointerDown}
         onMouseMove={handlePointerMove}
         onMouseUp={handlePointerUp}
         onMouseLeave={handlePointerUp}
         onTouchStart={handlePointerDown}
         onTouchMove={handlePointerMove}
         onTouchEnd={handlePointerUp}
         onWheel={handleWheel}
         onClick={handleClick}
         className={`w-full h-full ${activeTool ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'} transition-transform duration-300 ease-out ${
           isFlying ? 'scale-[1.03]' : 'scale-100'
         }`}
         style={{ 
             transformOrigin: 'center center',
             filter: `brightness(${imageSettings.brightness}%) contrast(${imageSettings.contrast}%) saturate(${imageSettings.saturation}%)` 
         }}
       />

       {/* Floating Top-Left Toolbox */}
       <div className="absolute top-4 left-4 z-30 flex flex-col gap-1.5 items-start">
         <button
           onClick={() => setShowToolbox(!showToolbox)}
           className="bg-slate-900/90 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl shadow-xl border border-slate-700/80 backdrop-blur-xl flex items-center gap-2.5 transition-all active:scale-95 group"
         >
           <Wrench size={15} className="text-blue-400 font-bold" />
           <span className="font-semibold text-xs tracking-wide text-white">Toolbox</span>
           {showToolbox ? (
             <ChevronDown size={14} className="text-blue-400 transition-transform ml-1" />
           ) : (
             <ChevronRight size={14} className="text-blue-400 transition-transform ml-1" />
           )}
         </button>

         {/* Expanded Toolbox Dropdown */}
         {showToolbox && (
           <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-xl p-1.5 shadow-2xl flex flex-col gap-1 w-[190px] animate-in fade-in slide-in-from-top-2 duration-200">
             <button
               onClick={() => {
                 setActiveTool(activeTool === 'digitize' ? null : 'digitize');
               }}
               className={`w-full p-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
                 activeTool === 'digitize' 
                   ? 'bg-blue-600 text-white shadow-md' 
                   : 'text-slate-300 hover:bg-slate-800 hover:text-white'
               }`}
             >
               <MapPin size={15} className={activeTool === 'digitize' ? 'text-white' : 'text-blue-400'} />
               <div className="flex flex-col text-left">
                 <span className="font-semibold text-[11px]">Digitize Asset</span>
                 <span className="text-[9px] text-slate-400 font-normal">Tag GIS features in 360°</span>
               </div>
             </button>

             <button
               onClick={() => {
                 setActiveTool(activeTool === '3d-measure' ? null : '3d-measure');
                 setP1Point(null);
                 setP2Point(null);
                 setDistanceResult(null);
               }}
               className={`w-full p-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
                 activeTool === '3d-measure' 
                   ? 'bg-blue-600 text-white shadow-md' 
                   : 'text-slate-300 hover:bg-slate-800 hover:text-white'
               }`}
             >
               <Ruler size={15} className={activeTool === '3d-measure' ? 'text-white' : 'text-blue-400'} />
               <div className="flex flex-col text-left">
                 <span className="font-semibold text-[11px]">3D Measure</span>
                 <span className="text-[9px] text-slate-400 font-normal">3D Distance & Clearance</span>
               </div>
             </button>
           </div>
         )}
       </div>

       {/* 3D Measurement Results Floating Panel */}
       {distanceResult && (
         <div className="absolute top-16 left-4 bg-slate-900/90 text-white p-3 rounded-xl border border-slate-700 shadow-xl z-30 text-xs min-w-[200px]">
           <div className="flex justify-between items-center mb-2 pb-1 border-b border-slate-700 font-semibold text-blue-400">
             <span>3D Distance Result</span>
             <button onClick={() => setDistanceResult(null)} className="hover:text-red-400"><X size={14} /></button>
           </div>
           <div className="space-y-1 font-mono text-slate-300">
             <div>3D Span: <span className="text-white font-bold">{distanceResult.distance3D} m</span></div>
             <div>Horizontal: <span className="text-white font-bold">{distanceResult.horizontalSpan} m</span></div>
             <div>Clearance: <span className="text-white font-bold">{distanceResult.verticalClearance} m</span></div>
           </div>
         </div>
       )}

       {/* Asset Digitizer Modal */}
       {pendingAssetPoint && (
         <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
           <div className="bg-slate-900 border border-slate-700 text-white p-5 rounded-2xl max-w-sm w-full shadow-2xl space-y-4">
             <div className="flex justify-between items-center border-b border-slate-800 pb-2">
               <h3 className="font-bold text-sm text-blue-400 flex items-center gap-2">
                 <MapPin size={18} /> Tag New GIS Asset
               </h3>
               <button onClick={() => setPendingAssetPoint(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
             </div>

             <div>
               <label className="text-xs text-slate-400 font-medium">Asset Category</label>
               <select 
                 value={assetCategory} 
                 onChange={e => setAssetCategory(e.target.value)}
                 className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white mt-1 focus:outline-none focus:border-blue-500"
               >
                 <option>Traffic Sign</option>
                 <option>Street Light</option>
                 <option>Manhole</option>
                 <option>Pothole</option>
                 <option>Guardrail</option>
                 <option>Utility Pole</option>
               </select>
             </div>

             <div>
               <label className="text-xs text-slate-400 font-medium">Condition</label>
               <select 
                 value={assetCondition} 
                 onChange={e => setAssetCondition(e.target.value)}
                 className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white mt-1 focus:outline-none focus:border-blue-500"
               >
                 <option>Good</option>
                 <option>Fair</option>
                 <option>Poor</option>
                 <option>Damaged</option>
               </select>
             </div>

             <div>
               <label className="text-xs text-slate-400 font-medium">Inspection Notes</label>
               <textarea 
                 value={assetNotes} 
                 onChange={e => setAssetNotes(e.target.value)}
                 placeholder="Add survey details..."
                 className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white mt-1 h-20 focus:outline-none focus:border-blue-500"
               />
             </div>

             <div className="flex gap-2 pt-2">
               <button 
                 onClick={() => setPendingAssetPoint(null)} 
                 className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-xs rounded-xl font-medium"
               >
                 Cancel
               </button>
               <button 
                 onClick={handleSaveAsset} 
                 className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-xs rounded-xl font-medium flex items-center justify-center gap-1"
               >
                 <Check size={14} /> Save Asset
               </button>
             </div>
           </div>
         </div>
       )}

       {/* Ground Arrow Hover Tooltip */}
       {activeHoverArrow && (
         <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-blue-600/90 text-white text-xs px-3.5 py-1.5 rounded-full shadow-lg pointer-events-none backdrop-blur-md font-medium tracking-wide flex items-center gap-1.5 animate-pulse z-30">
           <span>Click to navigate forward ({activeHoverArrow.distance ? `${activeHoverArrow.distance.toFixed(1)}m` : 'Next Frame'})</span>
         </div>
       )}

       {/* Initial Loading Overlay */}
       {isLoading && !error && (
         <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
         </div>
       )}

       {/* Error Overlay */}
       {error && (
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 text-red-400 gap-3 z-10 pointer-events-none backdrop-blur-sm">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
           </svg>
           <p className="text-sm font-medium">{error}</p>
         </div>
       )}
    </div>
  );
});

export default Viewer;
