/**
 * Remotion 2.0 UI Elements Components
 * Reusable UI elements for messages, indicators, etc.
 */

import React from 'react';
import { useCurrentFrame } from 'remotion';

interface MessageProps {
  x: number;
  y: number;
  type: 'success' | 'error' | 'info' | 'warning';
  text: string;
  opacity?: number;
}

export const MessageBox: React.FC<MessageProps> = ({ 
  x, 
  y, 
  type, 
  text,
  opacity = 1 
}) => {
  const styles = {
    success: { bg: '#10B981', icon: '✓' },
    error: { bg: '#EF4444', icon: '✗' },
    info: { bg: '#3B82F6', icon: 'ℹ' },
    warning: { bg: '#F59E0B', icon: '⚠' }
  };
  
  const style = styles[type];
  
  return (
    <div style={{
      position: 'absolute',
      top: y,
      left: x,
      opacity,
      backgroundColor: style.bg,
      color: 'white',
      padding: '20px 40px',
      borderRadius: 12,
      fontSize: 20,
      fontWeight: 'bold',
      boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }}>
      <span style={{ fontSize: 24 }}>{style.icon}</span>
      <span>{text}</span>
    </div>
  );
};

interface LoadingSpinnerProps {
  x: number;
  y: number;
  size?: number;
  color?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  x, 
  y, 
  size = 40,
  color = '#3B82F6'
}) => {
  const frame = useCurrentFrame();
  const rotation = (frame * 8) % 360;
  
  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      width: size,
      height: size,
      border: `4px solid rgba(59, 130, 246, 0.2)`,
      borderTop: `4px solid ${color}`,
      borderRadius: '50%',
      transform: `rotate(${rotation}deg)`,
    }} />
  );
};

interface DataPacketProps {
  x: number;
  y: number;
  label: string;
  color?: string;
}

export const DataPacket: React.FC<DataPacketProps> = ({ 
  x, 
  y, 
  label,
  color = '#3B82F6'
}) => {
  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      padding: '10px 20px',
      backgroundColor: color,
      color: 'white',
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 'bold',
      boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
      border: '2px solid rgba(255,255,255,0.3)',
    }}>
      📦 {label}
    </div>
  );
};

/**
 * Table component for restaurant scenes
 */
interface TableProps {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export const Table: React.FC<TableProps> = ({ x, y, width = 100, height = 60 }) => {
  return (
    <div style={{ position: 'absolute', left: x, top: y }}>
      {/* Tabletop */}
      <div style={{
        width,
        height: height * 0.6,
        backgroundColor: '#8B4513',
        borderRadius: '8px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
        border: '2px solid #5C2E0F',
        position: 'relative',
      }}>
        {/* Place setting indication */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 30,
          height: 30,
          borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.2)',
          border: '2px dashed rgba(255,255,255,0.4)',
        }} />
      </div>
      {/* Legs */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0 10px',
        marginTop: -4,
      }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: 8,
              height: height * 0.4,
              backgroundColor: '#5C2E0F',
              borderRadius: 2,
            }}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Meal/Plate component for serving food
 */
interface MealProps {
  x: number;
  y: number;
  type?: 'plate' | 'tray';
}

export const Meal: React.FC<MealProps> = ({ x, y, type = 'plate' }) => {
  if (type === 'plate') {
    return (
      <div style={{ position: 'absolute', left: x, top: y }}>
        {/* Plate */}
        <div style={{
          width: 70,
          height: 70,
          borderRadius: '50%',
          backgroundColor: '#F5F5DC',
          border: '3px solid #DAA520',
          boxShadow: '0 4px 8px rgba(0,0,0,0.3), inset 0 2px 4px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}>
          {/* Food on plate */}
          <div style={{
            width: 50,
            height: 50,
            borderRadius: '50%',
            backgroundColor: '#FF6B6B',
            opacity: 0.8,
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute',
              top: 10,
              left: 10,
              width: 10,
              height: 10,
              backgroundColor: '#FFD700',
              borderRadius: '50%',
            }} />
            <div style={{
              position: 'absolute',
              bottom: 10,
              right: 10,
              width: 8,
              height: 8,
              backgroundColor: '#90EE90',
              borderRadius: '50%',
            }} />
          </div>
        </div>
      </div>
    );
  }

  // Tray
  return (
    <div style={{ position: 'absolute', left: x, top: y }}>
      <div style={{
        width: 120,
        height: 50,
        backgroundColor: '#DAA520',
        borderRadius: '8px',
        border: '2px solid #8B6914',
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '10px',
      }}>
        {/* Plate on tray */}
        <div style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          backgroundColor: '#F5F5DC',
          border: '2px solid #DAA520',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)',
        }} />
        <div style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          backgroundColor: '#F5F5DC',
          border: '2px solid #DAA520',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)',
        }} />
      </div>
    </div>
  );
};

/**
 * Order Ticket component for showing orders
 */
interface OrderTicketProps {
  x: number;
  y: number;
  itemCount?: number;
  status?: 'pending' | 'preparing' | 'ready';
}

export const OrderTicket: React.FC<OrderTicketProps> = ({ x, y, itemCount = 1, status = 'pending' }) => {
  const statusColors = {
    pending: '#F59E0B',
    preparing: '#3B82F6',
    ready: '#10B981',
  };

  const statusIcons = {
    pending: '⏳',
    preparing: '👨‍🍳',
    ready: '✓',
  };

  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      width: 120,
      padding: '12px',
      backgroundColor: statusColors[status],
      color: 'white',
      borderRadius: '6px',
      boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
      fontWeight: 'bold',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>{statusIcons[status]}</div>
      <div style={{ fontSize: 12, marginBottom: 4 }}>
        {status === 'pending' && 'PENDING'}
        {status === 'preparing' && 'PREPARING'}
        {status === 'ready' && 'READY'}
      </div>
      <div style={{ fontSize: 11, opacity: 0.9 }}>
        {itemCount} {itemCount === 1 ? 'item' : 'items'}
      </div>
    </div>
  );
};
