/**
 * Remotion 2.0 Animation Composition
 * Main composition for rendering AI-generated animations
 */

import React from 'react';
import { Composition, useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';
import type { AnimationScript } from '../openaiProcessor';
import { AppCharacter, ChefCharacter, CustomerCharacter, WorkerCharacter } from '../components/Characters';
import { Restaurant, Bakery, Library, Factory } from '../components/Buildings';
import { MessageBox, LoadingSpinner, DataPacket, Table, Meal, OrderTicket } from '../components/UIElements';

const AnimationComposition: React.FC = () => {
  // Assuming 30 fps, max 60 seconds
  const fps = 30;
  const maxDurationInFrames = 60 * fps;

  return (
    <Composition
      id="AnimationComposition"
      component={AnimationRenderer}
      durationInFrames={maxDurationInFrames}
      fps={fps}
      width={1920}
      height={1080}
      defaultProps={{
        animationScript: {
          totalDuration: 0,
          scenes: [],
          voiceover: { text: '', segments: [] },
          style: { 
            backgroundColor: '#fff', 
            primaryColor: '#000', 
            secondaryColor: '#000', 
            accentColor: '#000', 
            fontFamily: 'Arial', 
            theme: 'light' 
          }
        },
      }}
    />
  );
};

const AnimationRenderer: React.FC<{ animationScript: AnimationScript }> = ({ animationScript }) => {
  const frame = useCurrentFrame();
  const fps = 30;
  const currentTime = (frame / fps) * 1000; // in ms

  // Find the current scene
  const currentScene = animationScript.scenes.find(
    (scene: any) => currentTime >= scene.startTime && currentTime < scene.endTime
  );

  if (!currentScene) {
    return (
      <AbsoluteFill style={{ backgroundColor: animationScript.style.backgroundColor }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          fontSize: '48px',
          color: animationScript.style.primaryColor,
          fontFamily: animationScript.style.fontFamily,
        }}>
          {animationScript.voiceover.text || 'Loading...'}
        </div>
      </AbsoluteFill>
    );
  }

  if (currentScene.elements.length === 0) {
    return (
      <AbsoluteFill style={{ backgroundColor: animationScript.style.backgroundColor }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          fontSize: '48px',
          color: animationScript.style.primaryColor,
          fontFamily: animationScript.style.fontFamily,
        }}>
          {currentScene.description}
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{
      backgroundColor: animationScript.style.backgroundColor,
      fontFamily: animationScript.style.fontFamily,
      color: animationScript.style.primaryColor,
    }}>
      {currentScene.elements.map((element: any, index: number) => {
        const safeElement = {
          ...element,
          x: element.x || 0,
          y: element.y || 0,
          color: element.color || animationScript.style.primaryColor,
        };

        // Calculate animated position
        let currentX = safeElement.x;
        let currentY = safeElement.y;
        if (element.animation) {
          const sceneStart = currentScene.startTime;
          const sceneEnd = currentScene.endTime;
          if (currentTime >= sceneStart && currentTime <= sceneEnd) {
            const sceneProgress = (currentTime - sceneStart) / (sceneEnd - sceneStart);
            const progress = Math.min(sceneProgress, 1);
            currentX = interpolate(progress, [0, 1], [element.animation.from.x, element.animation.to.x]);
            currentY = interpolate(progress, [0, 1], [element.animation.from.y, element.animation.to.y]);
          }
        }

        const style = {
          position: 'absolute' as const,
          left: `${currentX}px`,
          top: `${currentY}px`,
        };
        
        let content;
        switch (element.type) {
          case 'character':
            switch (element.name) {
              case 'AppCharacter':
                content = <AppCharacter x={0} y={0} emotion={element.emotion || 'happy'} />;
                break;
              case 'ChefCharacter':
                content = <ChefCharacter x={0} y={0} emotion={element.emotion || 'neutral'} />;
                break;
              case 'CustomerCharacter':
                content = <CustomerCharacter x={0} y={0} emotion={element.emotion || 'happy'} />;
                break;
              case 'WorkerCharacter':
                content = <WorkerCharacter x={0} y={0} emotion={element.emotion || 'neutral'} />;
                break;
              default:
                content = <AppCharacter x={0} y={0} emotion={element.emotion || 'happy'} />;
            }
            break;
          case 'building':
            switch (element.name) {
              case 'Restaurant':
                content = <Restaurant x={0} y={0} status={element.status as 'open' | 'closed' | 'busy' || 'open'} />;
                break;
              case 'Bakery':
                content = <Bakery x={0} y={0} status={element.status as 'open' | 'closed' | 'busy' || 'open'} />;
                break;
              case 'Library':
                content = <Library x={0} y={0} status={element.status as 'open' | 'closed' | 'busy' || 'open'} />;
                break;
              case 'Factory':
                content = <Factory x={0} y={0} status={element.status as 'open' | 'closed' | 'busy' || 'open'} />;
                break;
              default:
                content = <Restaurant x={0} y={0} status={element.status as 'open' | 'closed' | 'busy' || 'open'} />;
            }
            break;
          case 'messageBox':
            content = <MessageBox x={0} y={0} type="info" text={element.content || ''} />;
            break;
          case 'loadingSpinner':
            content = <LoadingSpinner x={0} y={0} />;
            break;
          case 'dataPacket':
            content = <DataPacket x={0} y={0} label={element.content || 'Data'} color={safeElement.color} />;
            break;
          case 'table':
            content = <Table x={0} y={0} width={element.width || 100} height={element.height || 60} />;
            break;
          case 'meal':
            content = <Meal x={0} y={0} type={(element.mealType as 'plate' | 'tray') || 'plate'} />;
            break;
          case 'orderTicket':
            content = <OrderTicket x={0} y={0} itemCount={element.itemCount || 1} status={(element.status as 'pending' | 'preparing' | 'ready') || 'pending'} />;
            break;
          case 'background':
            content = <div style={{ width: '100%', height: '100%', backgroundColor: safeElement.color }} />;
            break;
          case 'element':
            content = <div style={{ width: 60, height: 60, backgroundColor: safeElement.color, borderRadius: 8 }} />;
            break;
          case 'text':
          default:
            content = <div style={{ color: safeElement.color, fontSize: '24px', fontWeight: 'bold' }}>{element.content}</div>;
            break;
        }
        return (
          <div key={index} style={style}>
            {content}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export { AnimationComposition, AnimationRenderer };
