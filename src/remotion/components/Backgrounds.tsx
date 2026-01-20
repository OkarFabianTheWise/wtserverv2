/**
 * Remotion 2.0 Background Components
 * Reusable background/environment components
 */

import React from 'react';
import { useCurrentFrame } from 'remotion';

export const CityStreet: React.FC = () => {
  const frame = useCurrentFrame();
  
  return (
    <>
      {/* Street */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 100,
        backgroundColor: '#4B5563',
      }} />
      
      {/* Road lines */}
      {[...Array(15)].map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          bottom: 50,
          left: i * 100 - (frame * 2) % 100,
          width: 60,
          height: 4,
          backgroundColor: '#FCD34D',
        }} />
      ))}
      
      {/* Sidewalk */}
      <div style={{
        position: 'absolute',
        bottom: 100,
        left: 0,
        right: 0,
        height: 20,
        backgroundColor: '#9CA3AF',
      }} />
    </>
  );
};

export const OfficeBackground: React.FC = () => {
  return (
    <>
      {/* Floor */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 150,
        backgroundColor: '#E5E7EB',
      }} />
      
      {/* Wall */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 150,
        backgroundColor: '#F3F4F6',
      }} />
    </>
  );
};

export const CloudBackground: React.FC = () => {
  const frame = useCurrentFrame();
  
  return (
    <>
      {/* Sky gradient */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(to bottom, #3B82F6, #93C5FD)',
      }} />
      
      {/* Clouds */}
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: 50 + i * 80,
          left: (i * 300 - (frame * 0.5)) % 1200,
          width: 120,
          height: 40,
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderRadius: '50%',
          boxShadow: '60px 0 0 rgba(255, 255, 255, 0.8), -60px 0 0 rgba(255, 255, 255, 0.8)',
        }} />
      ))}
    </>
  );
};
