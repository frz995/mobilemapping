import React from 'react';
import { Sliders, X, RotateCcw } from 'lucide-react';

const CameraCalibrationPanel = ({ extrinsics, onChange, onClose }) => {
  const handleReset = () => {
    onChange({
      heading: 0,
      pitch: 0,
      roll: 0,
      cameraHeight: 2.35
    });
  };

  return (
    <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-4 shadow-2xl w-80 text-white animate-in fade-in slide-in-from-top-2 duration-200 select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
        <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
          <Sliders size={16} />
          <span>Camera Orientation & Calibration</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleReset}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            title="Reset Calibration"
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

      {/* Sliders Form */}
      <div className="space-y-3.5 text-xs">
        {/* Heading / Yaw Offset */}
        <div>
          <div className="flex justify-between items-center mb-1 font-medium text-slate-300">
            <span>Heading (Yaw Offset)</span>
            <span className="font-mono text-blue-400 font-semibold">{extrinsics.heading}°</span>
          </div>
          <input
            type="range"
            min="-180"
            max="180"
            step="0.5"
            value={extrinsics.heading}
            onChange={e => onChange({ heading: parseFloat(e.target.value) })}
            className="w-full accent-blue-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
          />
        </div>

        {/* Pitch Angle */}
        <div>
          <div className="flex justify-between items-center mb-1 font-medium text-slate-300">
            <span>Pitch Angle</span>
            <span className="font-mono text-blue-400 font-semibold">{extrinsics.pitch}°</span>
          </div>
          <input
            type="range"
            min="-45"
            max="45"
            step="0.5"
            value={extrinsics.pitch}
            onChange={e => onChange({ pitch: parseFloat(e.target.value) })}
            className="w-full accent-blue-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
          />
        </div>

        {/* Roll Angle */}
        <div>
          <div className="flex justify-between items-center mb-1 font-medium text-slate-300">
            <span>Roll (Tilt)</span>
            <span className="font-mono text-blue-400 font-semibold">{extrinsics.roll}°</span>
          </div>
          <input
            type="range"
            min="-30"
            max="30"
            step="0.5"
            value={extrinsics.roll}
            onChange={e => onChange({ roll: parseFloat(e.target.value) })}
            className="w-full accent-blue-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
          />
        </div>

        {/* Camera Sensor Height */}
        <div>
          <div className="flex justify-between items-center mb-1 font-medium text-slate-300">
            <span>Camera Sensor Height</span>
            <span className="font-mono text-green-400 font-semibold">{extrinsics.cameraHeight} m</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="10.0"
            step="0.05"
            value={extrinsics.cameraHeight}
            onChange={e => onChange({ cameraHeight: parseFloat(e.target.value) })}
            className="w-full accent-green-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};

export default CameraCalibrationPanel;
