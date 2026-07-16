/* eslint-disable no-unused-vars */
import React from 'react';
import { Badge } from '../ui';

export default function LeadMap({ leads, onLeadClick }) {
  // We simulate a map view since we don't have Google Maps/Mapbox API keys.
  // In a real app, you would use react-map-gl or @react-google-maps/api.

  // Only show leads that have real geographic coordinates
  const leadsWithLocation = leads.filter(l => l.latitude && l.longitude);

  return (
    <div className="rounded-lg shadow-sm border h-full flex flex-col relative overflow-hidden min-h-[600px]" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      {/* Mock Map Background */}
      <div 
        className="absolute inset-0 pointer-events-none" 
        style={{
          backgroundColor: 'var(--color-surface-2)',
          opacity: 0.5,
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(59, 130, 246, 0.2) 1px, transparent 0)',
          backgroundSize: '32px 32px'
        }}
      ></div>
      
      <div className="p-4 border-b backdrop-blur-sm z-10 flex justify-between items-center" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div>
          <h3 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>Lead Location Intelligence</h3>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Plan your site visits efficiently (Demo Map View)</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="success">Won</Badge>
          <Badge variant="primary">Active</Badge>
          <Badge variant="secondary">Lost/Cold</Badge>
        </div>
      </div>

      <div className="relative flex-1 p-6 z-10">
        {/* Render simulated pins or empty state */}
        {leadsWithLocation.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 mb-4 rounded-full bg-blue-50 text-blue-400 flex items-center justify-center">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h4 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>No location data available</h4>
            <p className="max-w-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
              None of your current leads have latitude and longitude coordinates. Add location data to your leads to see them on the map.
            </p>
          </div>
        ) : (
          leadsWithLocation.map(lead => {
            // Normalize to percentage for demo container (0-100%)
            const latPercent = ((lead.latitude - 12.9216) / 0.1) * 100;
            const lngPercent = ((lead.longitude - 77.5446) / 0.1) * 100;
            
            let colorClass = 'bg-blue-500';
            if (lead.stage_name?.toLowerCase().includes('won') || lead.stage_id === 'won') colorClass = 'bg-green-500';
            if (lead.stage_name?.toLowerCase().includes('lost') || lead.stage_id === 'lost') colorClass = 'bg-gray-400';

            return (
              <div 
                key={lead.id}
                className={`absolute w-4 h-4 rounded-full border-2 border-white shadow-md cursor-pointer transform -translate-x-1/2 -translate-y-1/2 hover:scale-150 transition-transform ${colorClass}`}
                style={{
                  top: `${Math.max(10, Math.min(90, latPercent))}%`,
                  left: `${Math.max(10, Math.min(90, lngPercent))}%`
                }}
                onClick={() => onLeadClick?.(lead.id)}
                title={`${lead.name} (${lead.stage_name || 'New'})`}
              >
                <div className="absolute top-5 left-1/2 -translate-x-1/2 text-[10px] px-2 py-1 rounded opacity-0 hover:opacity-100 whitespace-nowrap pointer-events-none" style={{ background: 'var(--color-text)', color: 'var(--color-surface)' }}>
                  {lead.name} • {lead.locality || 'No Locality'}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
