import React from 'react';
import { registerRoot } from 'remotion';
import { AnimationComposition } from './compositions/AnimationComposition';

/**
 * Remotion 2.0 Root Component
 * Entry point for Remotion rendering with dynamic animation support
 */
const RemotionRoot: React.FC = () => {
  return (
    <>
      <AnimationComposition />
    </>
  );
};

registerRoot(RemotionRoot);
