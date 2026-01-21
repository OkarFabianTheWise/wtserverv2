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
    from: {
        x: number;
        y: number;
    };
    to: {
        x: number;
        y: number;
    };
    duration: number;
}
export interface SceneElement {
    name: string;
    type: 'character' | 'building' | 'background' | 'element' | 'text' | 'messageBox' | 'dataPacket' | 'table' | 'meal' | 'orderTicket' | 'loadingSpinner';
    x: number;
    y: number;
    emotion?: 'happy' | 'sad' | 'neutral' | 'excited' | 'confused';
    status?: 'open' | 'closed' | 'busy' | 'pending' | 'preparing' | 'ready';
    content?: string;
    color?: string;
    mealType?: 'plate' | 'tray';
    itemCount?: number;
    width?: number;
    height?: number;
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
//# sourceMappingURL=types.d.ts.map