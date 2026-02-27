import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import 'pannellum/build/pannellum.css';
import 'pannellum';

const Viewer = forwardRef(({ image, configUrl, initialYaw, initialPitch, initialHfov, onViewChange }, ref) => {
  const viewerContainerRef = useRef(null);
  const viewerInstanceRef = useRef(null);

  useImperativeHandle(ref, () => ({
    captureSnapshot: async (metadata) => {
      if (!viewerInstanceRef.current) return null;
      
      const renderer = viewerInstanceRef.current.getRenderer();
      if (!renderer) return null;
      
      const webglCanvas = renderer.getCanvas();
      
      // Create a new canvas to compose image + overlay
      const canvas = document.createElement('canvas');
      canvas.width = webglCanvas.width;
      canvas.height = webglCanvas.height;
      const ctx = canvas.getContext('2d');
      
      // Draw the 360 view
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
    }
  }));

  useEffect(() => {
    if (!viewerContainerRef.current || (!image && !configUrl)) return;

    if (viewerInstanceRef.current) {
      try {
        viewerInstanceRef.current.destroy();
      } catch (e) {
        console.warn("Error destroying pannellum instance", e);
      }
    }

    console.log('Viewer: Loading Image URL:', image); // Debug log

    const init = async () => {
      let config;
      if (configUrl) {
        const res = await fetch(configUrl);
        config = await res.json();
      } else {
        config = {
          type: 'equirectangular',
          panorama: image,
          autoLoad: true,
          autoRotate: 0,
          crossOrigin: 'anonymous', // Enable CORS for cloud-stored images
          yaw: initialYaw || 0,
          pitch: initialPitch || 0,
          hfov: initialHfov || 100,
          showZoomCtrl: true,
          showFullscreenCtrl: true,
          compass: false,
          hotSpotDebug: false,
        };
      }
      viewerInstanceRef.current = window.pannellum.viewer(viewerContainerRef.current, config);
      const updateView = () => {
        if (viewerInstanceRef.current) {
          const yaw = viewerInstanceRef.current.getYaw();
          const pitch = viewerInstanceRef.current.getPitch();
          const hfov = viewerInstanceRef.current.getHfov();
          onViewChange({ yaw, pitch, hfov });
        }
      };
      viewerInstanceRef.current.on('mouseup', updateView);
      viewerInstanceRef.current.on('zoomchange', updateView);
      const intervalId = setInterval(updateView, 100);
      return () => clearInterval(intervalId);
    };
    let cleanup;
    init().then((c) => { cleanup = c; });

    return () => {
      if (cleanup) cleanup();
      if (viewerInstanceRef.current) {
        try {
          viewerInstanceRef.current.destroy();
        } catch (e) {
        }
      }
    };
  }, [image, configUrl]);

  return (
    <div className="w-full h-full relative group">
       <div ref={viewerContainerRef} className="w-full h-full" />
       
       {!image && !configUrl && (
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 text-gray-400 gap-4">
           <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
           <p className="text-sm font-medium tracking-wide uppercase">Select a point on the map</p>
         </div>
       )}
    </div>
  );
});

export default Viewer;
