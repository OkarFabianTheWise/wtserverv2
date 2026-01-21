/**
 * Remotion 2.0 OpenAI Processor
 * Adapted from the working remotion-sora-implementation-example
 * Generates AnimationScripts from text input using OpenAI GPT-4
 */
import { AnimationScript, Scene, SceneElement, Voiceover, Style, Animation, VoiceoverSegment } from './types.js';
export type { AnimationScript, Scene, SceneElement, Voiceover, Style, Animation, VoiceoverSegment };
/**
 * Generate audio voiceover using OpenAI's text-to-speech API
 * @param text The text to convert to speech
 * @param outputPath Path where to save the audio file
 * @returns Path to the generated audio file
 */
export declare function generateVoiceover(text: string, outputPath: string): Promise<string>;
/**
 * Process text with OpenAI to generate an AnimationScript
 * @param text The text to process (question, concept, or description)
 * @returns AnimationScript ready for rendering
 */
export declare function processCodeWithOpenAI(text: string): Promise<AnimationScript>;
/**
 * Gets frame count for a given duration in milliseconds
 * @param durationMs Duration in milliseconds
 * @param fps Frames per second (default: 30)
 * @returns Number of frames
 */
export declare function msToFrames(durationMs: number, fps?: number): number;
/**
 * Gets milliseconds for a given number of frames
 * @param frames Number of frames
 * @param fps Frames per second (default: 30)
 * @returns Duration in milliseconds
 */
export declare function framesToMs(frames: number, fps?: number): number;
/**
 * Generates a Remotion-ready composition object from AnimationScript
 * This can be directly used to create dynamic compositions
 */
export declare function generateCompositionConfig(script: AnimationScript): {
    id: string;
    durationInFrames: number;
    fps: number;
    width: number;
    height: number;
    defaultProps: {
        script: AnimationScript;
    };
};
/**
 * Extracts all unique characters used in the script
 */
export declare function getUsedCharacters(script: AnimationScript): string[];
/**
 * Extracts all unique buildings used in the script
 */
export declare function getUsedBuildings(script: AnimationScript): string[];
/**
 * Summary of what components are used in the animation
 */
export declare function getAnimationSummary(script: AnimationScript): {
    duration: string;
    scenes: number;
    characters: string[];
    buildings: string[];
    voiceoverLength: number;
    segments: number;
};
/**
 * Complete setup for Remotion v2 video generation
 * Processes code with OpenAI and returns all needed components for rendering
 *
 * @param script The code/concept to animate
 * @returns Object containing title, voiceoverText, and animationScript
 */
export declare function setupRemotionV2(script: string): Promise<{
    title: string;
    voiceoverText: string;
    animationScript: AnimationScript;
}>;
//# sourceMappingURL=openaiProcessor.d.ts.map