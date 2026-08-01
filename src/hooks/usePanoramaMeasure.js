import { useState, useCallback } from 'react';
import * as THREE from 'three';

export function usePanoramaMeasure() {
  // --- 1. Camera Calibration Extrinsics ---
  const [extrinsics, setExtrinsics] = useState({
    heading: 0,        // Yaw offset (-180 to 180 deg)
    pitch: 0,          // Pitch offset (-45 to 45 deg)
    roll: 0,           // Roll offset (-30 to 30 deg)
    cameraHeight: 2.35 // Height above ground in meters
  });

  const updateExtrinsics = useCallback((newExtrinsics) => {
    setExtrinsics(prev => ({ ...prev, ...newExtrinsics }));
  }, []);

  // --- 2. Vertical Height Measurement ---
  const [verticalBasePoint, setVerticalBasePoint] = useState(null);
  const [verticalTopPoint, setVerticalTopPoint] = useState(null);
  const [verticalHeightResult, setVerticalHeightResult] = useState(null);

  const resetVerticalMeasure = useCallback(() => {
    setVerticalBasePoint(null);
    setVerticalTopPoint(null);
    setVerticalHeightResult(null);
  }, []);

  const addVerticalPoint = useCallback((worldPoint, rayPitchDeg, rayYawDeg) => {
    const hCam = extrinsics.cameraHeight;

    if (!verticalBasePoint) {
      // Set Base Point (Green)
      const pointData = {
        x: worldPoint.x,
        y: worldPoint.y,
        z: worldPoint.z,
        pitch: rayPitchDeg,
        yaw: rayYawDeg
      };
      setVerticalBasePoint(pointData);
      setVerticalTopPoint(null);
      setVerticalHeightResult(null);
    } else if (!verticalTopPoint) {
      // Set Top Point (Red) & Calculate Height
      const topData = {
        x: worldPoint.x,
        y: worldPoint.y,
        z: worldPoint.z,
        pitch: rayPitchDeg,
        yaw: rayYawDeg
      };
      setVerticalTopPoint(topData);

      // Horizontal ground distance from camera to base point
      const basePitchRad = THREE.MathUtils.degToRad(verticalBasePoint.pitch);
      const topPitchRad = THREE.MathUtils.degToRad(rayPitchDeg);

      // Avoid division by zero when pitch is near horizon
      const safeBasePitch = Math.min(-0.5, basePitchRad);
      const distGround = Math.abs(hCam / Math.tan(safeBasePitch));

      // Height calculation: Z = distGround * tan(topPitch) + hCam
      const height = (distGround * Math.tan(topPitchRad)) + hCam;
      const validHeight = Math.max(0, height);

      // 3D midpoint normalized on sphere for text position
      const midVec = new THREE.Vector3(
        (verticalBasePoint.x + worldPoint.x) / 2,
        (verticalBasePoint.y + worldPoint.y) / 2,
        (verticalBasePoint.z + worldPoint.z) / 2
      ).normalize().multiplyScalar(500);

      setVerticalHeightResult({
        heightMeters: validHeight.toFixed(2),
        groundDistance: distGround.toFixed(2),
        midPoint3D: { x: midVec.x, y: midVec.y, z: midVec.z }
      });
    } else {
      // Reset and set new Base Point
      resetVerticalMeasure();
      setVerticalBasePoint({
        x: worldPoint.x,
        y: worldPoint.y,
        z: worldPoint.z,
        pitch: rayPitchDeg,
        yaw: rayYawDeg
      });
    }
  }, [extrinsics.cameraHeight, verticalBasePoint, verticalTopPoint, resetVerticalMeasure]);

  // --- 3. Ground Polygon & Area Measurement ---
  const [polygonVertices, setPolygonVertices] = useState([]);
  const [polygonResult, setPolygonResult] = useState(null);
  const [isPolygonComplete, setIsPolygonComplete] = useState(false);

  const resetPolygonMeasure = useCallback(() => {
    setPolygonVertices([]);
    setPolygonResult(null);
    setIsPolygonComplete(false);
  }, []);

  const finishPolygon = useCallback(() => {
    if (polygonVertices.length >= 3) {
      setIsPolygonComplete(true);
    }
  }, [polygonVertices.length]);

  const addPolygonVertex = useCallback((worldPoint, rayPitchDeg, rayYawDeg) => {
    const pitchRad = THREE.MathUtils.degToRad(rayPitchDeg);
    const yawRad = THREE.MathUtils.degToRad(rayYawDeg);
    const hCam = extrinsics.cameraHeight;

    // Ray ground plane intersection at Y = -hCam
    const sinPitch = Math.sin(pitchRad);
    const safeSinPitch = sinPitch >= 0 ? -0.01 : sinPitch;
    const t = -hCam / safeSinPitch;

    const groundX = t * Math.cos(pitchRad) * Math.sin(yawRad);
    const groundZ = t * Math.cos(pitchRad) * Math.cos(yawRad);

    const newVertex = {
      x: worldPoint.x,
      y: worldPoint.y,
      z: worldPoint.z,
      groundX,
      groundZ,
      pitch: rayPitchDeg,
      yaw: rayYawDeg
    };

    setPolygonVertices(prev => {
      // If polygon was complete, start fresh with new click
      let baseVertices = isPolygonComplete ? [] : [...prev];
      if (isPolygonComplete) {
        setIsPolygonComplete(false);
      }

      // Check if click is close to start vertex (closer than 2.5m ground distance) -> Complete polygon
      if (baseVertices.length >= 3) {
        const first = baseVertices[0];
        const dx = groundX - first.groundX;
        const dz = groundZ - first.groundZ;
        const distToStart = Math.sqrt(dx * dx + dz * dz);
        if (distToStart < 2.5) {
          setIsPolygonComplete(true);
          return baseVertices;
        }
      }

      const updated = [...baseVertices, newVertex];

      if (updated.length >= 2) {
        let areaSum = 0;
        let perimeterSum = 0;
        const count = updated.length;
        const segments = [];

        for (let i = 0; i < count; i++) {
          const j = (i + 1) % count;
          // Only compute closed loop segment if >= 3 points or complete
          if (count < 3 && i === count - 1) continue;

          const p1 = updated[i];
          const p2 = updated[j];

          areaSum += (p1.groundX * p2.groundZ) - (p2.groundX * p1.groundZ);

          const dX = p2.groundX - p1.groundX;
          const dZ = p2.groundZ - p1.groundZ;
          const segLen = Math.sqrt(dX * dX + dZ * dZ);
          perimeterSum += segLen;

          // Normalized 3D midpoint vector on 500m sphere
          const midVec = new THREE.Vector3(
            (p1.x + p2.x) / 2,
            (p1.y + p2.y) / 2,
            (p1.z + p2.z) / 2
          ).normalize().multiplyScalar(500);

          segments.push({
            p1,
            p2,
            midPoint3D: { x: midVec.x, y: midVec.y, z: midVec.z },
            lengthMeters: segLen.toFixed(2)
          });
        }

        // Polygon center 3D vector normalized on 500m sphere
        const centerVec = new THREE.Vector3(
          updated.reduce((s, v) => s + v.x, 0) / count,
          updated.reduce((s, v) => s + v.y, 0) / count,
          updated.reduce((s, v) => s + v.z, 0) / count
        ).normalize().multiplyScalar(500);

        const area = Math.abs(areaSum) / 2.0;
        setPolygonResult({
          areaM2: area.toFixed(2),
          perimeterM: perimeterSum.toFixed(2),
          vertexCount: count,
          segments,
          center3D: { x: centerVec.x, y: centerVec.y, z: centerVec.z }
        });
      } else {
        setPolygonResult(null);
      }
      return updated;
    });
  }, [extrinsics.cameraHeight, isPolygonComplete]);

  // --- 4. Coordinate Inspector ---
  const [inspectorData, setInspectorData] = useState(null);

  const updateInspector = useCallback((worldPoint, rayPitchDeg, rayYawDeg, centerLat = 0, centerLon = 0, centerElevation = 0) => {
    if (!worldPoint) {
      setInspectorData(null);
      return;
    }

    const pitchRad = THREE.MathUtils.degToRad(rayPitchDeg);
    const yawRad = THREE.MathUtils.degToRad(rayYawDeg + extrinsics.heading);
    const hCam = extrinsics.cameraHeight;

    const sinPitch = Math.sin(pitchRad);
    const safeSinPitch = sinPitch >= 0 ? -0.01 : sinPitch;
    const t = -hCam / safeSinPitch;

    // ENU Offsets in meters
    const eastMeters = t * Math.cos(pitchRad) * Math.sin(yawRad);
    const northMeters = t * Math.cos(pitchRad) * Math.cos(yawRad);
    const upMeters = (t * Math.sin(pitchRad)) + hCam;

    const metersPerDegreeLat = 111139.0;
    const metersPerDegreeLon = 111139.0 * Math.cos(THREE.MathUtils.degToRad(centerLat || 0));

    const pointLat = (centerLat || 0) + (northMeters / metersPerDegreeLat);
    const pointLon = (centerLon || 0) + (eastMeters / (metersPerDegreeLon || 111139.0));
    const pointElev = (centerElevation || 0) + upMeters;

    setInspectorData({
      lon: pointLon.toFixed(6),
      lat: pointLat.toFixed(6),
      elevation: pointElev.toFixed(3),
      zOffset: (-hCam).toFixed(3),
      worldPoint
    });
  }, [extrinsics.cameraHeight, extrinsics.heading]);

  return {
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
  };
}

export default usePanoramaMeasure;
