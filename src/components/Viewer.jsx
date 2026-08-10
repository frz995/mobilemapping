import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import {
  MapPin, Ruler, X, Check, Wrench, ChevronRight, ChevronDown,
  ArrowUpDown, Hexagon, Crosshair, Sun, Sliders, CheckCircle2
} from 'lucide-react';
import usePanoramaMeasure from '../hooks/usePanoramaMeasure';
import PanoramaLightingControl from './PanoramaLightingControl';
import CameraCalibrationPanel from './CameraCalibrationPanel';

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
  onNavigate,
  selectedPoint,
  hideToolbox = false
}, ref) => {
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const shouldHideToolbox = hideToolbox || searchParams.get('hideToolbox') === 'true' || searchParams.get('viewerOnly') === 'true';
  const containerRef = useRef(null);

  // Three.js Core Refs
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const materialCurrentRef = useRef(null);
  const materialTargetRef = useRef(null);
  const animFrameIdRef = useRef(null);

  // Scene Mesh Groups
  const groundArrowsGroupRef = useRef(null);
  const digitizedMarkersGroupRef = useRef(null);
  const measure3DGroupRef = useRef(null); // Native 3D Spatial Measurements Group

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
  const [activeTool, setActiveTool] = useState(null); // 'digitize' | '3d-measure' | 'vertical-height' | 'polygon-area' | 'coord-inspector'
  const [showToolbox, setShowToolbox] = useState(false);
  const [showLightingControl, setShowLightingControl] = useState(false);
  const [showCalibrationPanel, setShowCalibrationPanel] = useState(false);

  // Spatial Measurement Custom Hook
  const {
    extrinsics,
    updateExtrinsics,
    verticalBasePoint,
    verticalTopPoint,
    verticalHeightResult,
    addVerticalPoint,
    resetVerticalMeasure,
    polygonVertices,
    polygonResult,
    isPolygonComplete,
    finishPolygon,
    addPolygonVertex,
    resetPolygonMeasure,
    inspectorData,
    updateInspector
  } = usePanoramaMeasure();

  // Asset Digitizer Modal State
  const [pendingAssetPoint, setPendingAssetPoint] = useState(null);
  const [assetCategory, setAssetCategory] = useState('Traffic Sign');
  const [assetCondition, setAssetCondition] = useState('Good');
  const [assetNotes, setAssetNotes] = useState('');
  const [, setDigitizedAssets] = useState([]);

  // 3D Distance Measurement State
  const [p1Point, setP1Point] = useState(null);
  const [p2Point, setP2Point] = useState(null);
  const [distanceResult, setDistanceResult] = useState(null);

  // Projected Screen Refs (Direct DOM Updates)
  const vMidLabelRef = useRef(null);
  const inspectorLabelRef = useRef(null);
  const polyCenterLabelRef = useRef(null);

  // Screen Projection Tick State - REMOVED for performance
  // const [, setRenderTick] = useState(0);

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

  // Resolve panorama URL
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

  // Update Three.js Camera Orientation Deterministically (YXZ Order)
  const applyCameraMatrix = useCallback((shouldNotify = true) => {
    if (!cameraRef.current) return;
    const angles = cameraAngleRef.current;

    const pitchRad = THREE.MathUtils.degToRad(angles.pitch + extrinsics.pitch);
    const yawRad = THREE.MathUtils.degToRad(-(angles.yaw + extrinsics.heading));
    const rollRad = THREE.MathUtils.degToRad(extrinsics.roll);

    const euler = new THREE.Euler(pitchRad, yawRad, rollRad, 'YXZ');
    cameraRef.current.quaternion.setFromEuler(euler);

    cameraRef.current.fov = angles.fov;
    cameraRef.current.updateProjectionMatrix();

    if (shouldNotify && onViewChangeRef.current) {
      onViewChangeRef.current({ yaw: angles.yaw, pitch: angles.pitch, hfov: angles.fov });
    }
  }, [extrinsics]);

  // Update Ground 3D Navigation Arrows
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

  // Update Native 3D Spatial Measurement Objects in Three.js Scene
  const update3DMeasurements = useCallback(() => {
    if (!measure3DGroupRef.current) return;
    const group = measure3DGroupRef.current;

    while (group.children.length > 0) {
      const child = group.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      group.remove(child);
    }

    // 1. Vertical Height Base (Green) & Top (Red) 3D Boxes & Red Line
    if (verticalBasePoint) {
      // Base Box (Green)
      const baseGeo = new THREE.BoxGeometry(8, 8, 8);
      const baseMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.set(verticalBasePoint.x, verticalBasePoint.y, verticalBasePoint.z);
      group.add(baseMesh);

      if (verticalTopPoint) {
        // Top Box (Red)
        const topGeo = new THREE.BoxGeometry(8, 8, 8);
        const topMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const topMesh = new THREE.Mesh(topGeo, topMat);
        topMesh.position.set(verticalTopPoint.x, verticalTopPoint.y, verticalTopPoint.z);
        group.add(topMesh);

        // Vertical Red Line connecting Base & Top
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(verticalBasePoint.x, verticalBasePoint.y, verticalBasePoint.z),
          new THREE.Vector3(verticalTopPoint.x, verticalTopPoint.y, verticalTopPoint.z)
        ]);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 3 });
        const lineMesh = new THREE.Line(lineGeo, lineMat);
        group.add(lineMesh);
      }
    }

    // 2. Magenta/Pink Polygon Corner 3D Boxes & Line Loop
    if (polygonVertices.length > 0) {
      const pointsVec3 = polygonVertices.map(v => new THREE.Vector3(v.x, v.y, v.z));

      // Draw white corner boxes at each vertex
      pointsVec3.forEach(p => {
        const vertexGeo = new THREE.BoxGeometry(6, 6, 6);
        const vertexMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const vertexMesh = new THREE.Mesh(vertexGeo, vertexMat);
        vertexMesh.position.copy(p);
        group.add(vertexMesh);
      });

      // Connect vertices with Magenta/Pink 3D Line Loop (#ec4899)
      if (pointsVec3.length >= 2) {
        const polyGeo = new THREE.BufferGeometry().setFromPoints(pointsVec3);
        const polyMat = new THREE.LineLoop(polyGeo, new THREE.LineBasicMaterial({ color: 0xec4899, linewidth: 4 }));
        group.add(polyMat);
      }
    }
  }, [verticalBasePoint, verticalTopPoint, polygonVertices]);

  // Update 3D measurement objects when measurement state changes
  useEffect(() => {
    update3DMeasurements();
  }, [update3DMeasurements]);

  // Project 3D vector to 2D Container Pixels (Standard Three.js NDC Frustum Check)
  const projectToScreen = useCallback((vec3) => {
    if (!cameraRef.current || !containerRef.current || !vec3) return null;

    const vec = new THREE.Vector3(vec3.x, vec3.y, vec3.z);
    vec.project(cameraRef.current);

    // In Three.js NDC: vec.z < 1.0 means point is IN FRONT of camera frustum
    if (vec.z >= 1.0) {
      return null;
    }

    // Verify NDC screen bounds
    if (vec.x < -1.15 || vec.x > 1.15 || vec.y < -1.15 || vec.y > 1.15) {
      return null;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const x = (vec.x * 0.5 + 0.5) * rect.width;
    const y = (-vec.y * 0.5 + 0.5) * rect.height;
    return { x, y };
  }, []);

  // Initialize Three.js WebGL Scene & Animation Loop
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

    // 3. Ground 3D Navigation & Measurement Groups
    const arrowsGroup = new THREE.Group();
    scene.add(arrowsGroup);
    groundArrowsGroupRef.current = arrowsGroup;

    const digitizedGroup = new THREE.Group();
    scene.add(digitizedGroup);
    digitizedMarkersGroupRef.current = digitizedGroup;

    const measureGroup = new THREE.Group();
    scene.add(measureGroup);
    measure3DGroupRef.current = measureGroup;

    // 4. Smooth 60 FPS Damping Loop
    let lastNotifyTime = 0;
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      const angles = cameraAngleRef.current;
      const now = performance.now();

      const dampingFactor = 0.28;
      const yawDiff = getAngleDiff(angles.targetYaw, angles.yaw);
      angles.yaw += yawDiff * dampingFactor;

      angles.targetPitch = Math.max(-85, Math.min(85, angles.targetPitch));
      angles.pitch += (angles.targetPitch - angles.pitch) * dampingFactor;

      angles.targetFov = Math.max(30, Math.min(110, angles.targetFov));
      angles.fov += (angles.targetFov - angles.fov) * dampingFactor;

      // Notify parent smoothly at 60fps for hyper-responsive map cone
      const shouldNotify = now - lastNotifyTime > 16;
      if (shouldNotify) lastNotifyTime = now;

      applyCameraMatrix(shouldNotify);

      // Update projected labels directly in the loop to avoid React re-renders
      if (vMidLabelRef.current && verticalHeightResult?.midPoint3D) {
        const screenPos = projectToScreen(verticalHeightResult.midPoint3D);
        if (screenPos) {
          vMidLabelRef.current.style.display = 'block';
          vMidLabelRef.current.style.left = `${screenPos.x}px`;
          vMidLabelRef.current.style.top = `${screenPos.y}px`;
        } else {
          vMidLabelRef.current.style.display = 'none';
        }
      }

      if (inspectorLabelRef.current && inspectorData?.worldPoint) {
        const screenPos = projectToScreen(inspectorData.worldPoint);
        if (screenPos) {
          inspectorLabelRef.current.style.display = 'flex';
          inspectorLabelRef.current.style.left = `${screenPos.x}px`;
          inspectorLabelRef.current.style.top = `${screenPos.y}px`;
        } else {
          inspectorLabelRef.current.style.display = 'none';
        }
      }

      if (polyCenterLabelRef.current && polygonResult?.center3D) {
        const screenPos = projectToScreen(polygonResult.center3D);
        if (screenPos) {
          polyCenterLabelRef.current.style.display = 'block';
          polyCenterLabelRef.current.style.left = `${screenPos.x}px`;
          polyCenterLabelRef.current.style.top = `${screenPos.y}px`;
        } else {
          polyCenterLabelRef.current.style.display = 'none';
        }
      }

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

  // Update Ground Arrows when targets change
  useEffect(() => {
    updateGroundArrows();
  }, [navTargets, updateGroundArrows]);

  // Panorama Load & Dual-Buffer Transition
  useEffect(() => {
    let isCancelled = false;

    const loadAndTransition = async () => {
      try {
        const url = await resolvePanoramaUrl(image, configUrl);
        if (!url || isCancelled) return;

        const targetTexture = await loadGpuTexture(url);
        if (isCancelled) return;

        if (!materialCurrentRef.current.map || materialCurrentRef.current.map === targetTexture) {
          materialCurrentRef.current.map = targetTexture;
          materialCurrentRef.current.needsUpdate = true;

          if (!materialCurrentRef.current.map) {
            cameraAngleRef.current.yaw = initialYaw || 0;
            cameraAngleRef.current.targetYaw = initialYaw || 0;
            cameraAngleRef.current.pitch = initialPitch || 0;
            cameraAngleRef.current.targetPitch = initialPitch || 0;
          }

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
          cameraAngleRef.current.targetFov = startFov;

          if (cameraRef.current) {
            cameraRef.current.position.set(0, 0, 0);
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
  }, [image, configUrl, resolvePanoramaUrl]);

  // Pointer Handlers
  const handlePointerDown = useCallback((e) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX || e.touches?.[0]?.clientX || 0, y: e.clientY || e.touches?.[0]?.clientY || 0 };
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;

    const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
    const clientY = e.clientY || e.touches?.[0]?.clientY || 0;

    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    // Coordinate Inspector Real-Time Hover Update
    if (activeTool === 'coord-inspector') {
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const pointWorld = new THREE.Vector3();
      raycasterRef.current.ray.at(500, pointWorld);

      const r = pointWorld.length();
      const pitch = THREE.MathUtils.radToDeg(Math.asin(pointWorld.y / r));
      const yaw = THREE.MathUtils.radToDeg(Math.atan2(pointWorld.z, pointWorld.x));

      updateInspector(
        pointWorld,
        pitch,
        yaw,
        selectedPoint?.lat || 0,
        selectedPoint?.lon || 0,
        selectedPoint?.elevation || 0
      );
    }

    // Raycasting for 3D ground arrows hover
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
    const sensitivity = 0.13 * fovFactor;

    const deltaYaw = dx * sensitivity;
    const deltaPitch = dy * sensitivity;

    angles.targetYaw -= deltaYaw;
    angles.targetPitch += deltaPitch;
  }, [activeTool, selectedPoint, updateInspector]);

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const zoomSensitivity = 0.04;
    cameraAngleRef.current.targetFov += e.deltaY * zoomSensitivity;
  }, []);

  // Handle Tool Click Intersections (Exact 500m Sphere Radius)
  const handleClick = useCallback((e) => {
    if (activeHoverArrow && onNavigateRef.current) {
      onNavigateRef.current(activeHoverArrow);
      return;
    }

    if (!activeTool || !cameraRef.current) return;

    // Raycast on 500m panorama sphere
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const pointWorld = new THREE.Vector3();
    raycasterRef.current.ray.at(500, pointWorld);

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

        const dx = p2.x - p1Point.x;
        const dy = p2.y - p1Point.y;
        const dz = p2.z - p1Point.z;
        const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz) * 0.1;
        const horizontalSpan = Math.sqrt(dx * dx + dz * dz) * 0.1;
        const verticalClearance = Math.abs(dy) * 0.1;

        setDistanceResult({
          distance3D: dist3D.toFixed(2),
          horizontalSpan: horizontalSpan.toFixed(2),
          verticalClearance: verticalClearance.toFixed(2)
        });
      }
    } else if (activeTool === 'vertical-height') {
      addVerticalPoint(pointWorld, pitch, yaw);
    } else if (activeTool === 'polygon-area') {
      addPolygonVertex(pointWorld, pitch, yaw);
    } else if (activeTool === 'coord-inspector') {
      updateInspector(
        pointWorld,
        pitch,
        yaw,
        selectedPoint?.lat || 0,
        selectedPoint?.lon || 0,
        selectedPoint?.elevation || 0
      );
    }
  }, [activeHoverArrow, activeTool, p1Point, p2Point, addVerticalPoint, addPolygonVertex, updateInspector, selectedPoint]);

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

    if (digitizedMarkersGroupRef.current) {
      const pinGeo = new THREE.SphereGeometry(6, 16, 16);
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
        className={`w-full h-full ${activeTool ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'} transition-transform duration-300 ease-out ${isFlying ? 'scale-[1.03]' : 'scale-100'}`}
        style={{
          transformOrigin: 'center center',
          filter: `brightness(${imageSettings.brightness}%) contrast(${imageSettings.contrast}%) saturate(${imageSettings.saturation}%)`
        }}
      />

      {/* 1. Direct Vertical Height Midpoint Value Label (e.g. 9.99m) */}
      {verticalHeightResult && (
        <div
          ref={vMidLabelRef}
          className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
        >
          <span
            className="text-white text-xs font-bold font-mono tracking-tight"
            style={{ textShadow: '0 1px 3px #000, 0 0 5px #000' }}
          >
            {verticalHeightResult.heightMeters}m
          </span>
        </div>
      )}

      {/* 2. Direct Coordinate Inspector Cursor Box & Single-Line Text (39.199942, 21.409290, -2.350) */}
      {activeTool === 'coord-inspector' && inspectorData && (
        <div
          ref={inspectorLabelRef}
          className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-1/2 flex items-center gap-1"
        >
          {/* Small White Square Target Box Cursor */}
          <div className="w-3 h-3 bg-transparent border-2 border-white shadow-sm shrink-0" />
          <span
            className="text-white text-xs font-bold font-mono tracking-tight whitespace-nowrap"
            style={{ textShadow: '0 1px 3px #000, 0 0 5px #000' }}
          >
            {inspectorData.lon}, {inspectorData.lat}, {inspectorData.zOffset}
          </span>
        </div>
      )}

      {/* 3. Direct Polygon Center Total Overall Area Value Label (e.g. 13.22m² or 123.45m²) Floating at Center of Drawn Area */}
      {polygonResult && (
        <div
          ref={polyCenterLabelRef}
          className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
        >
          <span
            className="text-white text-xs font-bold font-mono tracking-tight"
            style={{ textShadow: '0 1px 3px #000, 0 0 5px #000' }}
          >
            {polygonResult.areaM2}m
          </span>
        </div>
      )}

      {/* Polygon Drawing Action Control (Finish Polygon Button) */}
      {polygonResult && polygonVertices.length >= 3 && !isPolygonComplete && (
        <div className="absolute top-16 left-4 z-30">
          <button
            onClick={finishPolygon}
            className="bg-slate-900/90 hover:bg-slate-800 text-white font-bold px-3 py-1.5 rounded-xl text-xs border border-pink-500/80 shadow-2xl backdrop-blur-md flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <CheckCircle2 size={14} className="text-pink-400" />
            <span>Finish Polygon</span>
          </button>
        </div>
      )}

      {/* Floating Top-Left Toolbox */}
      {!shouldHideToolbox && (
        <div className="absolute top-4 left-4 z-30 flex flex-col items-start">
          <button
            onClick={() => setShowToolbox(!showToolbox)}
            className="bg-white/90 hover:bg-white text-gray-700 px-3 py-1.5 rounded-xl shadow-md border border-gray-200/80 backdrop-blur-xl flex items-center gap-2.5 transition-all active:scale-95 group"
          >
            <Wrench size={15} className="text-blue-600 font-bold" />
            <span className="font-semibold text-xs tracking-wide text-gray-800">Toolbox</span>
            <ChevronDown
              size={15}
              className={`text-blue-600 transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ml-1 ${showToolbox ? 'rotate-180' : 'rotate-0'
                }`}
            />
          </button>

          {/* Expanded Toolbox Dropdown with Smooth Animation */}
          <div
            className={`grid transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] w-[220px] ${showToolbox
              ? 'grid-rows-[1fr] opacity-100 mt-1.5 pointer-events-auto'
              : 'grid-rows-[0fr] opacity-0 mt-0 pointer-events-none'
              }`}
          >
            <div className="overflow-hidden">
              <div className="bg-white/95 backdrop-blur-xl border border-gray-200/90 rounded-2xl p-1.5 shadow-2xl flex flex-col gap-1">
                {/* 360° Vertical Height Measurement */}
                <button
                  onClick={() => {
                    setActiveTool(activeTool === 'vertical-height' ? null : 'vertical-height');
                    resetVerticalMeasure();
                  }}
                  className={`w-full p-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${activeTool === 'vertical-height'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
                    }`}
                >
                  <ArrowUpDown size={15} className={activeTool === 'vertical-height' ? 'text-white' : 'text-red-500'} />
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-[11px]">360° Vertical Height</span>
                    <span className="text-[9px] text-gray-400 font-normal">Base (Green) & Top (Red)</span>
                  </div>
                </button>

                {/* 3D Spatial Distance Measurement */}
                <button
                  onClick={() => {
                    setActiveTool(activeTool === '3d-measure' ? null : '3d-measure');
                    setP1Point(null);
                    setP2Point(null);
                    setDistanceResult(null);
                  }}
                  className={`w-full p-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${activeTool === '3d-measure'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
                    }`}
                >
                  <Ruler size={15} className={activeTool === '3d-measure' ? 'text-white' : 'text-blue-600'} />
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-[11px]">3D Distance Measure</span>
                    <span className="text-[9px] text-gray-400 font-normal">Select Point 1 & Point 2</span>
                  </div>
                </button>

                {/* 3D Polygon Area & Perimeter */}
                <button
                  onClick={() => {
                    setActiveTool(activeTool === 'polygon-area' ? null : 'polygon-area');
                    resetPolygonMeasure();
                  }}
                  className={`w-full p-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${activeTool === 'polygon-area'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
                    }`}
                >
                  <Hexagon size={15} className={activeTool === 'polygon-area' ? 'text-white' : 'text-purple-600'} />
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-[11px]">Polygon Area & Boundary</span>
                    <span className="text-[9px] text-gray-400 font-normal">Click 3+ vertices in 3D</span>
                  </div>
                </button>

                {/* 3D Coordinate Inspector */}
                <button
                  onClick={() => {
                    setActiveTool(activeTool === 'coord-inspector' ? null : 'coord-inspector');
                    updateInspector(null);
                  }}
                  className={`w-full p-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${activeTool === 'coord-inspector'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
                    }`}
                >
                  <Crosshair size={15} className={activeTool === 'coord-inspector' ? 'text-white' : 'text-emerald-600'} />
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-[11px]">3D Point Inspector</span>
                    <span className="text-[9px] text-gray-400 font-normal">Hover/click for XYZ & Lat/Lng</span>
                  </div>
                </button>

                <div className="my-1 border-t border-gray-100" />

                {/* Image Lighting Control Toggle */}
                <button
                  onClick={() => setShowLightingControl(!showLightingControl)}
                  className={`w-full p-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${showLightingControl
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
                    }`}
                >
                  <Sun size={15} className={showLightingControl ? 'text-white' : 'text-amber-500'} />
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-[11px]">Image Lighting</span>
                    <span className="text-[9px] text-gray-400 font-normal">Brightness & contrast</span>
                  </div>
                </button>

                {/* Camera Calibration Panel Toggle */}
                <button
                  onClick={() => setShowCalibrationPanel(!showCalibrationPanel)}
                  className={`w-full p-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${showCalibrationPanel
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
                    }`}
                >
                  <Sliders size={15} className={showCalibrationPanel ? 'text-white' : 'text-blue-500'} />
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-[11px]">Camera Calibration</span>
                    <span className="text-[9px] text-gray-400 font-normal">Yaw, Pitch, Roll & Height</span>
                  </div>
                </button>

                <div className="my-1 border-t border-gray-100" />

                {/* Feature Extractor / Digitize Asset */}
                <button
                  onClick={() => setActiveTool(activeTool === 'digitize' ? null : 'digitize')}
                  className={`w-full p-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${activeTool === 'digitize'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
                    }`}
                >
                  <MapPin size={15} className={activeTool === 'digitize' ? 'text-white' : 'text-blue-500'} />
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-[11px]">Feature Extractor</span>
                    <span className="text-[9px] text-gray-400 font-normal">Extract asset & export GIS</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Image Lighting Slider Widget Overlay */}
      {showLightingControl && (
        <div className="absolute top-16 right-4 z-40">
          <PanoramaLightingControl
            settings={imageSettings}
            onChange={(newSet) => setImageSettings(prev => ({ ...prev, ...newSet }))}
            onClose={() => setShowLightingControl(false)}
          />
        </div>
      )}

      {/* Floating Camera Calibration Panel Overlay */}
      {showCalibrationPanel && (
        <div className="absolute top-16 left-60 z-40">
          <CameraCalibrationPanel
            extrinsics={extrinsics}
            onChange={updateExtrinsics}
            onClose={() => setShowCalibrationPanel(false)}
          />
        </div>
      )}

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
