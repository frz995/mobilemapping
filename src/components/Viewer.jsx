import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Viewer as PSVViewer } from '@photo-sphere-viewer/core';
import { CubemapTilesAdapter } from '@photo-sphere-viewer/cubemap-tiles-adapter';
import '@photo-sphere-viewer/core/index.css';
import {
  MapPin, Ruler, X, Check, Wrench, ChevronRight, ChevronDown,
  ArrowUpDown, Hexagon, Crosshair, Sun, Sliders, CheckCircle2
} from 'lucide-react';
import usePanoramaMeasure from '../hooks/usePanoramaMeasure';
import PanoramaLightingControl from './PanoramaLightingControl';
import CameraCalibrationPanel from './CameraCalibrationPanel';
import { buildCubemapPanorama, resolvePanoramaUrl, resolvePanoramaConfigUrl } from '../services/storage';

const SPHERE_RADIUS = 500;

// Convert a spherical position (yaw/pitch) to a world point on the measurement sphere.
// Matches the original Three.js raycast convention (pitch = asin(y/r), yaw = atan2(z,x)).
const sphericalToWorld = (yawRad, pitchRad) => {
  const cosP = Math.cos(pitchRad);
  return {
    x: SPHERE_RADIUS * cosP * Math.cos(yawRad),
    y: SPHERE_RADIUS * Math.sin(pitchRad),
    z: SPHERE_RADIUS * cosP * Math.sin(yawRad)
  };
};

const deg2rad = (d) => (d * Math.PI) / 180;

const Viewer = forwardRef(({
  image,
  configUrl,
  storageConfig,
  initialYaw = 0,
  initialPitch = 0,
  initialHfov = 100,
  onViewChange,
  navTargets = [],
  onNavigate,
  selectedPoint,
  hideToolbox = false
}, ref) => {
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const shouldHideToolbox = hideToolbox || searchParams.get('hideToolbox') === 'true' || searchParams.get('viewerOnly') === 'true';
  const containerRef = useRef(null);

  // PhotoSphereViewer instance
  const psvRef = useRef(null);

  // Three.js Core Refs (measurement / digitized markers overlay — transparent canvas)
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const animFrameIdRef = useRef(null);

  // Scene Mesh Groups
  const digitizedMarkersGroupRef = useRef(null);
  const measure3DGroupRef = useRef(null); // Native 3D Spatial Measurements Group

  // Camera Rotation State (mirrors PSV position so the measurement overlay stays aligned)
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

  // Refs mirroring state/props that the PSV event listeners need fresh each frame (avoids stale closures)
  const activeToolRef = useRef(activeTool);
  const selectedPointRef = useRef(selectedPoint);
  const p1PointRef = useRef(p1Point);
  const p2PointRef = useRef(p2Point);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { selectedPointRef.current = selectedPoint; }, [selectedPoint]);
  useEffect(() => { p1PointRef.current = p1Point; }, [p1Point]);
  useEffect(() => { p2PointRef.current = p2Point; }, [p2Point]);

  // Projected Screen Refs (Direct DOM Updates)
  const vMidLabelRef = useRef(null);
  const inspectorLabelRef = useRef(null);
  const polyCenterLabelRef = useRef(null);

  // Callback Refs
  const onViewChangeRef = useRef(onViewChange);
  const onNavigateRef = useRef(onNavigate);
  const navTargetsRef = useRef(navTargets);

  useEffect(() => {
    onViewChangeRef.current = onViewChange;
    onNavigateRef.current = onNavigate;
    navTargetsRef.current = navTargets;
  }, [onViewChange, onNavigate, navTargets]);

  // Imperative Snapshot Capture (draw from the PSV canvas)
  useImperativeHandle(ref, () => ({
    captureSnapshot: async (metadata) => {
      try {
        const psv = psvRef.current;
        const sourceCanvas = psv ? psv.container.querySelector('canvas') : rendererRef.current?.domElement;
        if (!sourceCanvas) return null;

        const canvas = document.createElement('canvas');
        canvas.width = sourceCanvas.width;
        canvas.height = sourceCanvas.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(sourceCanvas, 0, 0);

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

  // Apply Three.js measurement camera orientation from the current angle (mirrors PSV).
  const applyCameraMatrix = useCallback((shouldNotify = true) => {
    if (!cameraRef.current) return;
    const angles = cameraAngleRef.current;

    // The measurement overlay must align EXACTLY with PSV's rendered frame, so no
    // separate extrinsics roll/heading are applied here — PSV owns the panorama frame.
    const pitchRad = THREE.MathUtils.degToRad(angles.pitch);
    const yawRad = THREE.MathUtils.degToRad(-angles.yaw); // negate to match PSV's left-hand yaw → world mapping

    const euler = new THREE.Euler(pitchRad, yawRad, 0, 'YXZ');
    cameraRef.current.quaternion.setFromEuler(euler);

    cameraRef.current.fov = angles.fov;
    cameraRef.current.updateProjectionMatrix();

    if (shouldNotify && onViewChangeRef.current) {
      onViewChangeRef.current({ yaw: angles.yaw, pitch: angles.pitch, hfov: angles.fov });
    }
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
      const baseGeo = new THREE.BoxGeometry(8, 8, 8);
      const baseMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.set(verticalBasePoint.x, verticalBasePoint.y, verticalBasePoint.z);
      group.add(baseMesh);

      if (verticalTopPoint) {
        const topGeo = new THREE.BoxGeometry(8, 8, 8);
        const topMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const topMesh = new THREE.Mesh(topGeo, topMat);
        topMesh.position.set(verticalTopPoint.x, verticalTopPoint.y, verticalTopPoint.z);
        group.add(topMesh);

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

      pointsVec3.forEach(p => {
        const vertexGeo = new THREE.BoxGeometry(6, 6, 6);
        const vertexMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const vertexMesh = new THREE.Mesh(vertexGeo, vertexMat);
        vertexMesh.position.copy(p);
        group.add(vertexMesh);
      });

      if (pointsVec3.length >= 2) {
        const polyGeo = new THREE.BufferGeometry().setFromPoints(pointsVec3);
        const polyMat = new THREE.LineLoop(polyGeo, new THREE.LineBasicMaterial({ color: 0xec4899, linewidth: 4 }));
        group.add(polyMat);
      }
    }
  }, [verticalBasePoint, verticalTopPoint, polygonVertices]);

  useEffect(() => {
    update3DMeasurements();
  }, [update3DMeasurements]);

  // Project 3D vector to 2D Container Pixels (Standard Three.js NDC Frustum Check)
  const projectToScreen = useCallback((vec3) => {
    if (!cameraRef.current || !containerRef.current || !vec3) return null;
    const vec = new THREE.Vector3(vec3.x, vec3.y, vec3.z);
    vec.project(cameraRef.current);

    if (vec.z >= 1.0) return null;

    if (vec.x < -1.15 || vec.x > 1.15 || vec.y < -1.15 || vec.y > 1.15) return null;

    const rect = containerRef.current.getBoundingClientRect();
    const x = (vec.x * 0.5 + 0.5) * rect.width;
    const y = (-vec.y * 0.5 + 0.5) * rect.height;
    return { x, y };
  }, []);

  // Initialize the transparent Three.js measurement overlay canvas + animation loop.
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(initialHfov || 75, width / height, 0.1, 2000);
    camera.position.set(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.pointerEvents = 'none';
    renderer.domElement.style.zIndex = '5';
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const digitizedGroup = new THREE.Group();
    scene.add(digitizedGroup);
    digitizedMarkersGroupRef.current = digitizedGroup;

    const measureGroup = new THREE.Group();
    scene.add(measureGroup);
    measure3DGroupRef.current = measureGroup;

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      applyCameraMatrix(false);
      projectLabels();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Direct DOM label projection (kept out of React render cycle for performance)
  const projectLabels = useCallback(() => {
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
  }, [verticalHeightResult, inspectorData, polygonResult, projectToScreen]);

  // Keep PSV sized correctly when the split-panel container resizes
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      psvRef.current?.refresh?.();
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // PhotoSphereViewer instance + panorama loading (single equirectangular OR multi-res cubemap tiles)
  useEffect(() => {
    if (!containerRef.current) return;
    let isCancelled = false;

    const loadPanorama = async () => {
      try {
        let targetPanorama = null;
        const multiResEnabled = String(storageConfig?.imageStorageStrategy || '').toLowerCase() !== 'single_equirectangular'
          || storageConfig?.multiResEnabled === true;
        let useCubemap = Boolean(configUrl) && multiResEnabled;
        let resolvedImage = '';

        if (useCubemap) {
          const resolvedConfigUrl = /^https?:\/\//i.test(configUrl)
            ? configUrl
            : resolvePanoramaConfigUrl(configUrl || image, storageConfig, selectedPoint?.subgrid || '');
          targetPanorama = buildCubemapPanorama(resolvedConfigUrl);
        } else if (image) {
          resolvedImage = await resolvePanoramaUrl(image, storageConfig, {
            subgrid: selectedPoint?.subgrid || ''
          });
          targetPanorama = resolvedImage || image;
        }

        if (isCancelled || !targetPanorama) {
          setIsLoading(false);
          return;
        }

        // Preloader for single equirectangular images to dismiss the overlay promptly
        if (!useCubemap && targetPanorama && typeof targetPanorama === 'string') {
          const preloadImg = new Image();
          preloadImg.crossOrigin = 'anonymous';
          preloadImg.onload = () => { if (!isCancelled) setIsLoading(false); };
          preloadImg.onerror = () => { if (!isCancelled) setIsLoading(false); };
          preloadImg.src = targetPanorama;
        }

        if (psvRef.current) {
          // Hot-swap the panorama on the existing PSV instance
          psvRef.current.setPanorama(targetPanorama, { transition: false, showLoader: false })
            .then(() => {
              if (!isCancelled) {
                setIsLoading(false);
                setError(null);
              }
            })
            .catch((err) => {
              console.warn('Viewer: setPanorama notice:', err);
              if (!isCancelled) setIsLoading(false);
            });
          return;
        }

        const viewer = new PSVViewer({
          container: containerRef.current,
          adapter: useCubemap ? CubemapTilesAdapter : undefined,
          sphereCorrection: { pan: '0deg' },
          navbar: false,
          panorama: targetPanorama,
          caption: '',
          defaultYaw: deg2rad(-(initialYaw || 0)),
          defaultPitch: deg2rad(initialPitch || 0),
          defaultZoomLvl: 0,
          touchmoveTwoFingers: false,
          mousewheel: true,
          mousewheelCtrlKey: false,
          loadingImg: undefined,
          loadingTxt: '',
          moveSpeed: 1,
          minFov: 30,
          maxFov: 110
        });

        viewer.addEventListener('ready', () => { if (!isCancelled) setIsLoading(false); });
        viewer.addEventListener('panorama-loaded', () => { if (!isCancelled) setIsLoading(false); });
        viewer.addEventListener('panorama-error', (e) => {
          console.error('Viewer: PSV panorama error:', e);
          if (!isCancelled) {
            setIsLoading(false);
            setError('Failed to load 360° imagery');
          }
        });

        // Keep the measurement camera + map cone in sync with PSV at ~60fps
        viewer.addEventListener('position-updated', ({ position }) => {
          if (!isCancelled) {
            const posPitchDeg = (position.pitch * 180) / Math.PI;
            const posYawDeg = (position.yaw * 180) / Math.PI;

            // Measurement overlay camera stays aligned to PSV's rendered frame.
            cameraAngleRef.current.yaw = -posYawDeg;
            cameraAngleRef.current.targetYaw = cameraAngleRef.current.yaw;
            cameraAngleRef.current.pitch = posPitchDeg;
            cameraAngleRef.current.targetPitch = cameraAngleRef.current.pitch;

            // Map cone: report the ABSOLUTE compass heading the viewer faces.
            // PSV starts at defaultYaw = -(bearing), so relative pan from the
            // vehicle forward = posYawDeg + bearing, and the absolute compass
            // heading is bearing + relativePan = posYawDeg + 2*bearing.
            const bearing = initialYaw || 0;
            const coneYaw = (((posYawDeg + 2 * bearing) % 360) + 360) % 360;

            onViewChangeRef.current?.({
              yaw: coneYaw,
              pitch: posPitchDeg,
              hfov: viewer.getZoomLevel()
            });
          }
        });

        viewer.addEventListener('zoom-updated', ({ zoomLevel }) => {
          if (!isCancelled) {
            cameraAngleRef.current.fov = zoomLevel;
            cameraAngleRef.current.targetFov = zoomLevel;
          }
        });

        // Tool clicks: PSV provides yaw/pitch in radians at the click point
        viewer.addEventListener('click', ({ data }) => {
          if (isCancelled || !data) return;
          handleToolClick(data);
        });

        psvRef.current = viewer;
      } catch (err) {
        console.error("Viewer: Failed to load panorama:", err);
        if (!isCancelled) {
          setIsLoading(false);
          setError("Failed to load 360° imagery");
        }
      }
    };

    loadPanorama();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, configUrl, storageConfig, initialYaw, initialPitch]);

  // Handle tool clicks (from PSV ClickEvent) using spherical yaw/pitch
  const handleToolClick = useCallback((data) => {
    const yawRad = data.yaw;
    const pitchRad = data.pitch;
    const worldPoint = sphericalToWorld(yawRad, pitchRad);
    const pitchDeg = (pitchRad * 180) / Math.PI;
    const yawDeg = (yawRad * 180) / Math.PI;
    const tool = activeToolRef.current;

    if (tool === 'digitize') {
      setPendingAssetPoint({ pitch: pitchDeg, yaw: yawDeg, x: worldPoint.x, y: worldPoint.y, z: worldPoint.z });
    } else if (tool === '3d-measure') {
      const p1 = p1PointRef.current;
      const p2 = p2PointRef.current;
      if (!p1) {
        setP1Point({ x: worldPoint.x, y: worldPoint.y, z: worldPoint.z });
      } else if (!p2) {
        const p2Pt = { x: worldPoint.x, y: worldPoint.y, z: worldPoint.z };
        setP2Point(p2Pt);

        const dx = p2Pt.x - p1.x;
        const dy = p2Pt.y - p1.y;
        const dz = p2Pt.z - p1.z;
        const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz) * 0.1;
        const horizontalSpan = Math.sqrt(dx * dx + dz * dz) * 0.1;
        const verticalClearance = Math.abs(dy) * 0.1;

        setDistanceResult({
          distance3D: dist3D.toFixed(2),
          horizontalSpan: horizontalSpan.toFixed(2),
          verticalClearance: verticalClearance.toFixed(2)
        });
      }
    } else if (tool === 'vertical-height') {
      addVerticalPoint(worldPoint, pitchDeg, yawDeg);
    } else if (tool === 'polygon-area') {
      addPolygonVertex(worldPoint, pitchDeg, yawDeg);
    } else if (tool === 'coord-inspector') {
      const sp = selectedPointRef.current;
      updateInspector(
        worldPoint,
        pitchDeg,
        yawDeg,
        sp?.lat || 0,
        sp?.lon || 0,
        sp?.elevation || 0
      );
    }
  }, [addVerticalPoint, addPolygonVertex, updateInspector]);

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
      {/* PhotoSphereViewer Container */}
      <div
        ref={containerRef}
        className={`w-full h-full ${activeTool ? 'cursor-crosshair' : 'cursor-grab'} transition-transform duration-300 ease-out`}
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

      {/* 2. Direct Coordinate Inspector Cursor Box & Single-Line Text */}
      {activeTool === 'coord-inspector' && inspectorData && (
        <div
          ref={inspectorLabelRef}
          className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-1/2 flex items-center gap-1"
        >
          <div className="w-3 h-3 bg-transparent border-2 border-white shadow-sm shrink-0" />
          <span
            className="text-white text-xs font-bold font-mono tracking-tight whitespace-nowrap"
            style={{ textShadow: '0 1px 3px #000, 0 0 5px #000' }}
          >
            {inspectorData.lon}, {inspectorData.lat}, {inspectorData.zOffset}
          </span>
        </div>
      )}

      {/* 3. Direct Polygon Center Total Overall Area Value Label */}
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
              className={`text-blue-600 transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ml-1 ${showToolbox ? 'rotate-180' : 'rotate-0'}`}
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
                {canCalibrate !== false && (
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
                )}

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
