/**
 * Remotion 2.0 Character Components
 * Reusable character components for analogies
 */
import React from 'react';
interface CharacterProps {
    x: number;
    y: number;
    scale?: number;
    emotion?: 'happy' | 'sad' | 'neutral' | 'excited' | 'confused';
}
export declare const AppCharacter: React.FC<CharacterProps>;
interface ChefCharacterProps extends CharacterProps {
    holdingTray?: boolean;
    isWalking?: boolean;
    walkingDirection?: 'left' | 'right';
}
export declare const ChefCharacter: React.FC<ChefCharacterProps>;
export declare const CustomerCharacter: React.FC<CharacterProps>;
export declare const WorkerCharacter: React.FC<CharacterProps & {
    color?: string;
}>;
export {};
//# sourceMappingURL=Characters.d.ts.map