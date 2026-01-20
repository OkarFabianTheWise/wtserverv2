/**
 * Remotion 2.0 Building Components
 * Reusable building/location components
 */

import React from 'react';
import { useCurrentFrame } from 'remotion';

interface BuildingProps {
  x: number;
  y: number;
  status?: 'open' | 'closed' | 'busy';
  label?: string;
}

// Restaurant/Kitchen (for API/Server analogies)
export const Restaurant: React.FC<BuildingProps> = ({ x, y, status = 'open', label = '🍽️ API' }) => {
  const statusColors = {
    open: '#10B981',
    closed: '#EF4444',
    busy: '#F59E0B'
  };
  
  return (
    <div style={{ position: 'absolute', left: x, top: y }}>
      <div style={{
        width: 140,
        height: 160,
        backgroundColor: '#DC2626',
        borderRadius: '8px 8px 0 0',
        position: 'relative',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}>
        {/* Awning */}
        <div style={{
          position: 'absolute',
          top: 60,
          left: 0,
          width: 140,
          height: 30,
          backgroundColor: '#7C2D12',
          borderRadius: '5px',
        }}>
          {[...Array(7)].map((_, i) => (
            <div key={i} style={{
              position: 'absolute',
              bottom: -15,
              left: i * 20,
              width: 0,
              height: 0,
              borderLeft: '10px solid transparent',
              borderRight: '10px solid transparent',
              borderTop: '15px solid #7C2D12',
            }} />
          ))}
        </div>
        
        {/* Sign */}
        <div style={{
          position: 'absolute',
          top: 20,
          left: 20,
          width: 100,
          height: 30,
          backgroundColor: statusColors[status],
          borderRadius: 5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          fontSize: 14,
        }}>
          {label}
        </div>
        
        {/* Door */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 45,
          width: 50,
          height: 70,
          backgroundColor: status === 'open' ? '#10B981' : '#6B7280',
          borderRadius: '8px 8px 0 0',
        }} />
        
        {/* Status */}
        <div style={{
          position: 'absolute',
          bottom: 100,
          right: 10,
          padding: '4px 8px',
          backgroundColor: statusColors[status],
          color: 'white',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 'bold',
        }}>
          {status.toUpperCase()}
        </div>
      </div>
    </div>
  );
};

// Bakery/Shop (for boolean returns, simple services)
export const Bakery: React.FC<BuildingProps> = ({ x, y, status = 'open', label = '🥖 BAKERY' }) => {
  return (
    <div style={{ position: 'absolute', left: x, top: y }}>
      <div style={{
        width: 120,
        height: 150,
        backgroundColor: '#8B4513',
        borderRadius: '8px 8px 0 0',
        position: 'relative',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}>
        {/* Roof */}
        <div style={{
          position: 'absolute',
          top: -30,
          left: -10,
          width: 0,
          height: 0,
          borderLeft: '70px solid transparent',
          borderRight: '70px solid transparent',
          borderBottom: '30px solid #F59E0B',
        }} />
        
        {/* Sign */}
        <div style={{
          position: 'absolute',
          top: 20,
          left: 10,
          width: 100,
          height: 30,
          backgroundColor: '#10B981',
          borderRadius: 5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          fontSize: 14,
        }}>
          {label}
        </div>
        
        {/* Door */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 35,
          width: 50,
          height: 70,
          backgroundColor: status === 'open' ? '#10B981' : '#555',
          borderRadius: '8px 8px 0 0',
        }} />
        
        {/* Status indicator */}
        <div style={{
          position: 'absolute',
          bottom: 80,
          right: 10,
          padding: '4px 8px',
          backgroundColor: status === 'open' ? '#10B981' : '#EF4444',
          color: 'white',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 'bold',
        }}>
          {status === 'open' ? 'OPEN' : 'CLOSED'}
        </div>
      </div>
    </div>
  );
};

// Library/Database (for storage/data analogies)
export const Library: React.FC<BuildingProps> = ({ x, y, status = 'open', label = '📚 DATABASE' }) => {
  return (
    <div style={{ position: 'absolute', left: x, top: y }}>
      <div style={{
        width: 150,
        height: 180,
        backgroundColor: '#1E3A8A',
        borderRadius: '10px 10px 0 0',
        position: 'relative',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}>
        {/* Columns */}
        {[20, 50, 80, 110].map((left, i) => (
          <div key={i} style={{
            position: 'absolute',
            bottom: 0,
            left,
            width: 20,
            height: 140,
            backgroundColor: '#F3F4F6',
            borderRadius: '5px 5px 0 0',
          }} />
        ))}
        
        {/* Sign */}
        <div style={{
          position: 'absolute',
          top: 15,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 16px',
          backgroundColor: '#059669',
          color: 'white',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 'bold',
          zIndex: 10,
        }}>
          {label}
        </div>
      </div>
    </div>
  );
};

// Factory/Pipeline (for build systems, data processing)
export const Factory: React.FC<BuildingProps> = ({ x, y, status = 'open', label = '🏭 PIPELINE' }) => {
  const frame = useCurrentFrame();
  const smoke = Math.sin(frame / 10) * 2;
  
  return (
    <div style={{ position: 'absolute', left: x, top: y }}>
      {/* Smokestack */}
      <div style={{
        position: 'absolute',
        top: -60,
        left: 80,
        width: 25,
        height: 60,
        backgroundColor: '#374151',
        borderRadius: '5px 5px 0 0',
      }}>
        {/* Smoke */}
        <div style={{
          position: 'absolute',
          top: -20 + smoke,
          left: 5,
          width: 15,
          height: 15,
          backgroundColor: 'rgba(156, 163, 175, 0.6)',
          borderRadius: '50%',
        }} />
      </div>
      
      {/* Main building */}
      <div style={{
        width: 160,
        height: 140,
        backgroundColor: '#6B7280',
        position: 'relative',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}>
        {/* Windows */}
        {[20, 60, 100].map((left, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: 30,
            left,
            width: 30,
            height: 40,
            backgroundColor: status === 'open' ? '#FCD34D' : '#374151',
            borderRadius: 3,
          }} />
        ))}
        
        {/* Sign */}
        <div style={{
          position: 'absolute',
          bottom: 90,
          left: 10,
          padding: '6px 12px',
          backgroundColor: '#F59E0B',
          color: 'white',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 'bold',
        }}>
          {label}
        </div>
        
        {/* Loading dock */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          right: 20,
          width: 60,
          height: 50,
          backgroundColor: '#374151',
          borderRadius: '5px 5px 0 0',
        }} />
      </div>
    </div>
  );
};
