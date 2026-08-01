import React from 'react';
import { Sun, X, RotateCcw } from 'lucide-react';

const PanoramaLightingControl = ({ settings, onChange, onClose }) => {
  const handleReset = () => {
    onChange({ brightness: 100, contrast: 100, saturation: 100 });
  };

  return (
    <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-4 shadow-2xl w-72 text-white animate-in fade-in slide-in-from-top-2 duration-200 select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <div className="flex items-center gap-2 text-yellow-400 font-bold text-xs">
          <Sun size={16} />
          <span>Panorama Image Lighting</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleReset}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            title="Reset Lighting"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Lighting Sliders */}
      <div className="space-y-3 text-xs">
        <div>
          <div className="flex justify-between items-center mb-1 font-medium text-slate-300">
            <span>Brightness</span>
            <span className="font-mono text-yellow-400 font-semibold">{settings.brightness}%</span>
          </div>
          <input
            type="range"
            min="30"
            max="250"
            value={settings.brightness}
            onChange={e => onChange({ brightness: parseInt(e.target.value) })}
            className="w-full accent-yellow-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1 font-medium text-slate-300">
            <span>Contrast</span>
            <span className="font-mono text-blue-400 font-semibold">{settings.contrast}%</span>
          </div>
          <input
            type="range"
            min="30"
            max="250"
            value={settings.contrast}
            onChange={e => onChange({ contrast: parseInt(e.target.value) })}
            className="w-full accent-blue-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1 font-medium text-slate-300">
            <span>Saturation</span>
            <span className="font-mono text-pink-400 font-semibold">{settings.saturation}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="250"
            value={settings.saturation}
            onChange={e => onChange({ saturation: parseInt(e.target.value) })}
            className="w-full accent-pink-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};

export default PanoramaLightingControl;
