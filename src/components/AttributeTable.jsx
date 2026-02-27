import React, { useState } from 'react';
import { X, Download, Search, MapPin } from 'lucide-react';

const AttributeTable = ({ points, isOpen, onClose, onPointSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' });

  if (!isOpen) return null;

  // Filter
  const filteredData = points.filter(point => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      point.id.toString().includes(searchLower) ||
      (point.subgrid && point.subgrid.toLowerCase().includes(searchLower)) ||
      (point.date && point.date.includes(searchLower)) ||
      (point.description && point.description.toLowerCase().includes(searchLower))
    );
  });

  // Sort
  const sortedData = [...filteredData].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleExport = () => {
    if (!sortedData.length) return;
    
    const headers = Object.keys(sortedData[0]).join(',');
    const csv = [
      headers,
      ...sortedData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attributes_export_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  return (
    <div className="w-full bg-white border-t border-gray-200 shadow-lg z-[2000] flex flex-col transition-all duration-300 h-1/3 relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <h3 className="font-semibold text-gray-700">Attribute Table ({sortedData.length} features)</h3>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Filter..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExport}
            className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Export CSV"
          >
            <Download size={18} />
          </button>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-2 sticky left-0 bg-gray-50">Actions</th>
              {points.length > 0 && Object.keys(points[0]).map(key => (
                <th 
                  key={key} 
                  className="px-4 py-2 cursor-pointer hover:bg-gray-100"
                  onClick={() => requestSort(key)}
                >
                  <div className="flex items-center gap-1">
                    {key}
                    {sortConfig.key === key && (
                      <span className="text-[10px]">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((point) => (
              <tr key={point.id} className="bg-white border-b hover:bg-gray-50">
                <td className="px-4 py-2 sticky left-0 bg-white border-r border-gray-100">
                  <button 
                    onClick={() => onPointSelect(point)}
                    className="text-blue-600 hover:text-blue-800"
                    title="Zoom to Feature"
                  >
                    <MapPin size={16} />
                  </button>
                </td>
                {Object.entries(point).map(([key, val]) => (
                  <td key={key} className="px-4 py-2 whitespace-nowrap max-w-xs overflow-hidden text-ellipsis">
                    {typeof val === 'object' ? JSON.stringify(val) : val}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttributeTable;
