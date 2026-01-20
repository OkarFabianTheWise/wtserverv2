/**
 * Remotion 2.0 Animation Types
 * Adapted from the working remotion-sora-implementation-example
 */

export interface VoiceoverSegment {
    startTime: number;
    endTime: number;
    text: string;
}

export interface Animation {
    from: { x: number; y: number };
    to: { x: number; y: number };
    duration: number;
}

export interface SceneElement {
    name: string; // Exact component name: AppCharacter, Restaurant, Table, Meal, OrderTicket, etc.
    type: 'character' | 'building' | 'background' | 'element' | 'text' | 'messageBox' | 'dataPacket' | 'table' | 'meal' | 'orderTicket' | 'loadingSpinner';
    x: number; // 0-1920 pixels
    y: number; // 0-1080 pixels
    emotion?: 'happy' | 'sad' | 'neutral' | 'excited' | 'confused';
    status?: 'open' | 'closed' | 'busy' | 'pending' | 'preparing' | 'ready';
    content?: string;
    color?: string;
    mealType?: 'plate' | 'tray'; // For Meal component
    itemCount?: number; // For OrderTicket component
    width?: number; // For Table component
    height?: number; // For Table component
    animation?: Animation;
}

export interface SceneTransition {
    from: string | number;
    to: string | number;
    startTime: number;
    endTime: number;
}

export interface Scene {
    id: string | number;
    startTime: number;
    endTime: number;
    description: string;
    elements: SceneElement[];
    transitions?: SceneTransition[];
}

export interface Voiceover {
    text: string;
    segments: VoiceoverSegment[];
}

export interface Style {
    backgroundColor: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    fontFamily: string;
    theme: string;
}

export interface AnimationScript {
    title?: string;
    totalDuration: number;
    voiceover: Voiceover;
    scenes: Scene[];
    style: Style;
    compositionId?: 'AnimationComposition' | 'BakeryComposition' | 'RestaurantComposition' | 'FactoryComposition';
}
