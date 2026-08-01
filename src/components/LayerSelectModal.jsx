import React, { useState, useMemo } from 'react';
import { Layers, X, Table, Check, MapPin } from 'lucide-react';

export const LayerSelectModal = ({ isOpen, onClose, onSelectLayer, activeLayers = [] }) => {
  // Dynamically filter & build layer items based ONLY on currently active map layers
  const displayLayers = useMemo(() => {
    if (!activeLayers || activeLayers.length === 0) {
      return [{
        id: 'panotrack',
        name: 'Panotrack (360 Views)',
        type: '360° Point Layer',
        icon: MapPin,
        badgeColor: 'bg-blue-50 text-blue-600 border-blue-200'
      }];
    }

    return activeLayers.map(layerId => {
      if (layerId === 'panotrack') {
        return {
          id: 'panotrack',
          name: 'Panotrack (360 Views)',
          type: '360° Point Layer',
          icon: MapPin,
          badgeColor: 'bg-blue-50 text-blue-600 border-blue-200'
        };
      }

      // Format layer name cleanly
      const cleanName = layerId.charAt(0).toUpperCase() + layerId.slice(1).replace(/_/g, ' ');
      return {
        id: layerId,
        name: cleanName,
        type: 'Active Map Layer',
        icon: Layers,
        badgeColor: 'bg-emerald-50 text-emerald-600 border-emerald-200'
      };
    });
  }, [activeLayers]);

  const [selectedLayerId, setSelectedLayerId] = useState('panotrack');

  if (!isOpen) return null;

  const handleConfirm = () => {
    const layer = displayLayers.find(l => l.id === selectedLayerId) || displayLayers[0];
    onSelectLayer(layer);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white/95 backdrop-blur-xl border border-gray-200/90 rounded-2xl shadow-2xl max-w-md w-full p-6 text-gray-800 space-y-5 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 border border-blue-100 rounded-xl text-blue-600">
              <Table size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-800 tracking-tight">Select Active Map Layer</h3>
              <p className="text-[11px] text-gray-500 font-medium">Select an active layer to inspect its attribute table</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Active Layer Options List */}
        <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
          {displayLayers.map((layer) => {
            const IconComp = layer.icon;
            const isSelected = selectedLayerId === layer.id;

            return (
              <div
                key={layer.id}
                onClick={() => setSelectedLayerId(layer.id)}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-blue-50/80 border-blue-500/80 shadow-md shadow-blue-500/10'
                    : 'bg-gray-50/80 border-gray-200/80 hover:bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-xl shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-200/80 text-gray-600'}`}>
                    <IconComp size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-xs text-gray-800 truncate">{layer.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${layer.badgeColor}`}>
                        {layer.type}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                  isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white'
                }`}>
                  {isSelected && <Check size={12} strokeWidth={3} />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 flex items-center gap-2 transition-all active:scale-95"
          >
            <Table size={15} />
            <span>Open Attribute Table</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LayerSelectModal;
