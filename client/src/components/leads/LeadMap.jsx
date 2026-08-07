import React, { useEffect, useRef, useState } from 'react';
import { Badge } from '../ui';

export default function LeadMap({ leads, onLeadClick }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState(null);

  const leadsWithLocation = (leads || []).filter(l => l.latitude && l.longitude);

  useEffect(() => {
    // Load Leaflet dynamically to avoid requiring npm install
    if (window.L) {
      setLeafletLoaded(true);
      return;
    }

    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => {
      setLeafletLoaded(true);
    };
    document.head.appendChild(script);

    return () => {
      // We don't remove the script/css to allow caching and reuse across mounts
    };
  }, []);

  useEffect(() => {
    if (!leafletLoaded || !mapRef.current) return;

    if (!mapInstance.current) {
      // Initialize map
      const map = window.L.map(mapRef.current, {
        zoomControl: false, // We'll add it in a custom position
        attributionControl: false // Cleaner UI, we can add it custom if needed
      }).setView([12.9716, 77.5946], 11); // Default to Bangalore

      window.L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Voyager map tiles from CartoDB (beautiful, clean street map)
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      mapInstance.current = map;
    }

    const map = mapInstance.current;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    if (leadsWithLocation.length === 0) return;

    const bounds = window.L.latLngBounds();

    leadsWithLocation.forEach(lead => {
      const lat = parseFloat(lead.latitude);
      const lng = parseFloat(lead.longitude);
      
      if (isNaN(lat) || isNaN(lng)) return;
      
      bounds.extend([lat, lng]);

      let color = '#3b82f6'; // Active (blue)
      if (lead.stage_name?.toLowerCase().includes('won') || lead.stage_id === 'won') color = '#22c55e'; // Won (green)
      if (lead.stage_name?.toLowerCase().includes('lost') || lead.stage_id === 'lost') color = '#9ca3af'; // Lost (gray)
      
      const isSelected = selectedLeadId === lead.id;

      const markerHtml = `
        <div style="
          width: ${isSelected ? '36px' : '28px'}; 
          height: ${isSelected ? '36px' : '28px'}; 
          background: ${color}; 
          border: 3px solid white; 
          border-radius: 50%; 
          box-shadow: 0 ${isSelected ? '8px 16px' : '4px 6px'} -1px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: ${isSelected ? '14px' : '12px'};
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          transform: scale(${isSelected ? 1.1 : 1});
          z-index: ${isSelected ? 1000 : 1};
        ">
          ${(lead.name || '?').charAt(0).toUpperCase()}
        </div>
      `;

      const icon = window.L.divIcon({
        html: markerHtml,
        className: '',
        iconSize: [isSelected ? 36 : 28, isSelected ? 36 : 28],
        iconAnchor: [isSelected ? 18 : 14, isSelected ? 18 : 14]
      });

      const marker = window.L.marker([lat, lng], { 
        icon,
        zIndexOffset: isSelected ? 1000 : 0
      }).addTo(map);
      
      marker.on('click', () => {
        setSelectedLeadId(lead.id);
        map.flyTo([lat, lng], 15, { duration: 0.8 });
      });

      markersRef.current.push(marker);
    });

    if (leadsWithLocation.length > 0 && !selectedLeadId) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, duration: 1 });
    }

  }, [leafletLoaded, leadsWithLocation, selectedLeadId]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="rounded-xl shadow-sm h-full relative overflow-hidden min-h-[600px]" style={{ border: '1px solid var(--color-border)' }}>
      
      {/* Main Map Container (Now full width) */}
      <div className="absolute inset-0 bg-[#e5e5e5]">
        {!leafletLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm z-10">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-4"></div>
            <p className="text-sm font-medium text-gray-600">Loading street map...</p>
          </div>
        )}
        
        {/* The DOM element Leaflet attaches to */}
        <div ref={mapRef} className="absolute inset-0 z-0" style={{ outline: 'none' }} />
        
        {/* Floating Legend overlay on top of map */}
        <div className="absolute top-5 right-5 z-[400] bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-xl border border-white/20">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Map Legend</h4>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-[#22c55e] border-2 border-white shadow-sm"></div>
              <span className="text-sm font-medium text-gray-700">Won Leads</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-[#3b82f6] border-2 border-white shadow-sm"></div>
              <span className="text-sm font-medium text-gray-700">Active Leads</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-[#9ca3af] border-2 border-white shadow-sm"></div>
              <span className="text-sm font-medium text-gray-700">Lost / Cold</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Dropdown for Map Overview */}
      <div className="absolute top-5 left-5 z-[500]">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="bg-white/95 backdrop-blur-md px-4 py-3 rounded-xl shadow-lg border border-gray-200 flex items-center gap-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex flex-col items-start">
            <span className="text-lg font-bold text-gray-900">Map Overview</span>
            <span className="text-xs font-medium text-gray-500">{leadsWithLocation.length} locations available</span>
          </div>
          <div className={`p-1.5 rounded-full bg-gray-100 text-gray-500 transition-transform duration-300 ${isSidebarOpen ? 'rotate-180' : ''}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </button>

        {isSidebarOpen && (
          <div className="absolute top-full left-0 mt-3 w-96 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 flex flex-col overflow-hidden max-h-[450px]">
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50/50">
              {leadsWithLocation.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center">
                  <div className="w-16 h-16 mb-4 rounded-full bg-blue-50 text-blue-400 flex items-center justify-center shadow-sm">
                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-700">No Location Data</h4>
                  <p className="text-sm text-gray-500 mt-2">
                    Add latitude and longitude coordinates to your leads to see them plotted on this map.
                  </p>
                </div>
              ) : (
                leadsWithLocation.map(lead => {
                  let badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                  let dotColor = 'bg-blue-500';
                  if (lead.stage_name?.toLowerCase().includes('won') || lead.stage_id === 'won') {
                    badgeColor = 'bg-green-50 text-green-700 border-green-200';
                    dotColor = 'bg-green-500';
                  }
                  if (lead.stage_name?.toLowerCase().includes('lost') || lead.stage_id === 'lost') {
                    badgeColor = 'bg-gray-100 text-gray-700 border-gray-200';
                    dotColor = 'bg-gray-400';
                  }

                  const isSelected = selectedLeadId === lead.id;

                  return (
                    <div 
                      key={lead.id}
                      className={`p-4 rounded-xl cursor-pointer transition-all border ${isSelected ? 'border-blue-400 bg-blue-50/30 shadow-md transform scale-[1.02]' : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'}`}
                      onClick={() => {
                        setSelectedLeadId(lead.id);
                        if (mapInstance.current && lead.latitude && lead.longitude) {
                          mapInstance.current.flyTo([lead.latitude, lead.longitude], 16, { duration: 0.8 });
                          // Optional: Auto-close dropdown on mobile or always
                          // setIsSidebarOpen(false); 
                        }
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold text-gray-900 text-base">{lead.name || 'Unnamed Lead'}</div>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${badgeColor}`}>
                          {lead.stage_name || 'New'}
                        </span>
                      </div>
                      
                      <div className="flex items-start text-sm text-gray-600 mb-3">
                        <svg className="w-4 h-4 mr-1.5 mt-0.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        <span className="line-clamp-2">{lead.locality || lead.address || 'No address provided'}</span>
                      </div>
                      
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${dotColor}`}></div>
                          <span className="text-xs font-medium text-gray-500">
                            {lead.score ? `Score: ${lead.score}` : 'No Score'}
                          </span>
                        </div>
                        <button 
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            onLeadClick?.(lead.id);
                          }}
                        >
                          View Profile <span aria-hidden="true">&rarr;</span>
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
