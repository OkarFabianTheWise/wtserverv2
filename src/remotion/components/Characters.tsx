/**
 * Remotion 2.0 Character Components
 * Reusable character components for analogies
 */

import React from 'react';
import { useCurrentFrame } from 'remotion';

interface CharacterProps {
  x: number;
  y: number;
  scale?: number;
  emotion?: 'happy' | 'sad' | 'neutral' | 'excited' | 'confused';
}

// Generic App Character (for API/Server concepts)
export const AppCharacter: React.FC<CharacterProps> = ({ 
  x, 
  y, 
  scale = 1,
  emotion = 'happy'
}) => {
  const frame = useCurrentFrame();
  const bob = Math.sin(frame / 5) * 3;
  
  const emotions = {
    happy: { eyeHeight: 8, mouthBorder: '3px solid white', mouthRadius: '0 0 10px 10px' },
    sad: { eyeHeight: 6, mouthBorder: '3px solid #aaa', mouthRadius: '10px 10px 0 0' },
    neutral: { eyeHeight: 6, mouthBorder: '2px solid white', mouthRadius: '0' },
    excited: { eyeHeight: 10, mouthBorder: '4px solid white', mouthRadius: '0 0 15px 15px' },
    confused: { eyeHeight: 7, mouthBorder: '3px solid #aaa', mouthRadius: '5px' }
  };
  
  const currentEmotion = emotions[emotion];
  
  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y + bob,
      transform: `scale(${scale})`,
      transition: 'all 0.3s ease',
    }}>
      <div style={{
        width: 60,
        height: 80,
        backgroundColor: '#3B82F6',
        borderRadius: '30px 30px 20px 20px',
        position: 'relative',
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
      }}>
        <div style={{ position: 'absolute', top: 15, left: 15 }}>
          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{
              width: 8,
              height: currentEmotion.eyeHeight,
              backgroundColor: 'white',
              borderRadius: '50%',
            }} />
            <div style={{
              width: 8,
              height: currentEmotion.eyeHeight,
              backgroundColor: 'white',
              borderRadius: '50%',
            }} />
          </div>
          <div style={{
            marginTop: 8,
            marginLeft: 5,
            width: 20,
            height: 10,
            borderBottom: currentEmotion.mouthBorder,
            borderRadius: currentEmotion.mouthRadius,
          }} />
        </div>
        
        {/* Arms */}
        <div style={{
          position: 'absolute',
          top: 30,
          left: -10,
          width: 8,
          height: 25,
          backgroundColor: '#3B82F6',
          borderRadius: 4,
          transform: `rotate(${emotion === 'happy' || emotion === 'excited' ? -20 : 10}deg)`,
        }} />
        <div style={{
          position: 'absolute',
          top: 30,
          right: -10,
          width: 8,
          height: 25,
          backgroundColor: '#3B82F6',
          borderRadius: 4,
          transform: `rotate(${emotion === 'happy' || emotion === 'excited' ? 20 : -10}deg)`,
        }} />
        
        {/* Legs */}
        <div style={{
          position: 'absolute',
          bottom: -20,
          left: 10,
          width: 8,
          height: 20,
          backgroundColor: '#3B82F6',
          borderRadius: 4,
        }} />
        <div style={{
          position: 'absolute',
          bottom: -20,
          right: 10,
          width: 8,
          height: 20,
          backgroundColor: '#3B82F6',
          borderRadius: 4,
        }} />
      </div>
    </div>
  );
};

// Chef Character (for Kitchen/Restaurant analogies)
interface ChefCharacterProps extends CharacterProps {
  holdingTray?: boolean;
  isWalking?: boolean;
  walkingDirection?: 'left' | 'right';
}

export const ChefCharacter: React.FC<ChefCharacterProps> = ({ 
  x, 
  y, 
  scale = 1,
  emotion = 'happy',
  holdingTray = false,
  isWalking = false,
  walkingDirection = 'right'
}) => {
  const frame = useCurrentFrame();
  
  // Vertical bob - reduced when walking
  const bob = Math.sin(frame / 5) * (isWalking ? 1 : 3);
  
  // Walking leg animation
  const leftLegRotation = isWalking ? Math.sin(frame / 5) * 25 : 0;
  const rightLegRotation = isWalking ? Math.sin(frame / 5 + Math.PI) * 25 : 0;
  
  // Arm swing synchronized with walking
  const leftArmRotation = isWalking 
    ? -20 + Math.sin(frame / 5) * 30 
    : holdingTray 
    ? 10 
    : -20;
  
  const rightArmRotation = isWalking 
    ? 20 + Math.sin(frame / 5 + Math.PI) * 30 
    : holdingTray 
    ? -10 
    : 20;
  
  const mirror = walkingDirection === 'left' ? -1 : 1;
  
  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y + bob,
      transform: `scale(${scale * mirror}, ${scale})`,
      transformOrigin: 'center',
    }}>
      {/* Chef Hat */}
      <div style={{
        width: 70,
        height: 30,
        backgroundColor: 'white',
        borderRadius: '50% 50% 0 0',
        position: 'relative',
        top: -10,
        left: -5,
        border: '2px solid #E5E7EB',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      }} />
      
      {/* Head */}
      <div style={{
        width: 60,
        height: 80,
        backgroundColor: '#FCD34D',
        borderRadius: '30px',
        position: 'relative',
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
      }}>
        <div style={{ position: 'absolute', top: 20, left: 15 }}>
          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ width: 8, height: 8, backgroundColor: '#1F2937', borderRadius: '50%' }} />
            <div style={{ width: 8, height: 8, backgroundColor: '#1F2937', borderRadius: '50%' }} />
          </div>
          <div style={{
            marginTop: 10,
            marginLeft: 5,
            width: 20,
            height: 8,
            borderBottom: emotion === 'happy' ? '3px solid #1F2937' : '3px solid #6B7280',
            borderRadius: emotion === 'happy' ? '0 0 10px 10px' : '10px 10px 0 0',
          }} />
        </div>
        
        {/* Body with Apron */}
        <div style={{
          position: 'absolute',
          top: 70,
          left: -5,
          width: 70,
          height: 60,
          backgroundColor: 'white',
          borderRadius: '10px 10px 20px 20px',
          border: '2px solid #E5E7EB',
        }} />
        
        {/* Left Arm with swinging motion */}
        <div style={{
          position: 'absolute',
          top: 30,
          left: -20,
          width: 10,
          height: 35,
          backgroundColor: '#FCD34D',
          borderRadius: 5,
          transformOrigin: 'top center',
          transform: `rotate(${leftArmRotation}deg)`,
          transition: isWalking ? 'none' : 'transform 0.3s ease',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}>
          {/* Left Hand */}
          <div style={{
            position: 'absolute',
            bottom: -8,
            left: -4,
            width: 18,
            height: 12,
            backgroundColor: '#F5A623',
            borderRadius: '50%',
          }} />
        </div>
        
        {/* Right Arm with swinging motion */}
        <div style={{
          position: 'absolute',
          top: 30,
          right: -20,
          width: 10,
          height: 35,
          backgroundColor: '#FCD34D',
          borderRadius: 5,
          transformOrigin: 'top center',
          transform: `rotate(${rightArmRotation}deg)`,
          transition: isWalking ? 'none' : 'transform 0.3s ease',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}>
          {/* Right Hand */}
          <div style={{
            position: 'absolute',
            bottom: -8,
            right: -4,
            width: 18,
            height: 12,
            backgroundColor: '#F5A623',
            borderRadius: '50%',
          }} />
        </div>
      </div>
      
      {/* Left Leg with walking animation */}
      <div style={{
        position: 'absolute',
        bottom: -25,
        left: 15,
        width: 10,
        height: 25,
        backgroundColor: '#1F2937',
        borderRadius: 5,
        transformOrigin: 'top center',
        transform: `rotate(${leftLegRotation}deg)`,
        transition: isWalking ? 'none' : 'transform 0.3s ease',
      }} />
      
      {/* Right Leg with walking animation */}
      <div style={{
        position: 'absolute',
        bottom: -25,
        right: 15,
        width: 10,
        height: 25,
        backgroundColor: '#1F2937',
        borderRadius: 5,
        transformOrigin: 'top center',
        transform: `rotate(${rightLegRotation}deg)`,
        transition: isWalking ? 'none' : 'transform 0.3s ease',
      }} />
      
      {/* Tray - positioned in hands when holdingTray is true */}
      {holdingTray && (
        <div style={{
          position: 'absolute',
          top: 70,
          left: 5,
          width: 100,
          height: 40,
          backgroundColor: '#DAA520',
          borderRadius: '6px',
          border: '2px solid #8B6914',
          boxShadow: '0 6px 12px rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '6px',
          zIndex: -1,
        }}>
          {/* Plates on tray */}
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            backgroundColor: '#F5F5DC',
            border: '2px solid #DAA520',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)',
          }} />
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            backgroundColor: '#F5F5DC',
            border: '2px solid #DAA520',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)',
          }} />
        </div>
      )}
    </div>
  );
};

// Customer Character (for Request/Client analogies)
export const CustomerCharacter: React.FC<CharacterProps> = ({ 
  x, 
  y, 
  scale = 1,
  emotion = 'neutral'
}) => {
  const frame = useCurrentFrame();
  const bob = Math.sin(frame / 5) * 3;
  
  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y + bob,
      transform: `scale(${scale})`,
    }}>
      <div style={{
        width: 60,
        height: 80,
        backgroundColor: '#8B5CF6',
        borderRadius: '30px 30px 20px 20px',
        position: 'relative',
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
      }}>
        <div style={{ position: 'absolute', top: 15, left: 15 }}>
          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ width: 8, height: 8, backgroundColor: 'white', borderRadius: '50%' }} />
            <div style={{ width: 8, height: 8, backgroundColor: 'white', borderRadius: '50%' }} />
          </div>
          <div style={{
            marginTop: 8,
            marginLeft: 5,
            width: 20,
            height: 8,
            borderBottom: '3px solid white',
            borderRadius: '0',
          }} />
        </div>
      </div>
    </div>
  );
};

// Worker/Team Member Character (for coordination/roles)
export const WorkerCharacter: React.FC<CharacterProps & { color?: string }> = ({ 
  x, 
  y, 
  scale = 1,
  emotion = 'neutral',
  color = '#F59E0B'
}) => {
  const frame = useCurrentFrame();
  const bob = Math.sin(frame / 5) * 3;
  
  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y + bob,
      transform: `scale(${scale})`,
    }}>
      {/* Hard Hat */}
      <div style={{
        width: 65,
        height: 20,
        backgroundColor: color,
        borderRadius: '10px 10px 0 0',
        position: 'relative',
        top: -5,
        left: -2.5,
        border: '2px solid rgba(0,0,0,0.2)',
      }} />
      
      {/* Head & Body */}
      <div style={{
        width: 60,
        height: 80,
        backgroundColor: '#10B981',
        borderRadius: '20px 20px 20px 20px',
        position: 'relative',
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
      }}>
        <div style={{ position: 'absolute', top: 15, left: 15 }}>
          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ width: 8, height: 8, backgroundColor: 'white', borderRadius: '50%' }} />
            <div style={{ width: 8, height: 8, backgroundColor: 'white', borderRadius: '50%' }} />
          </div>
        </div>
      </div>
    </div>
  );
};
