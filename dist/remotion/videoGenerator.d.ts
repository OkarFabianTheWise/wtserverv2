/**
 * Remotion 2.0 Video Generator
 * Generates videos from AnimationScripts using the working Remotion 2D rendering system
 * Adapted from the remotion-sora-implementation-example
 */
import type { AnimationScript } from './types';
/**
 * Render an AnimationScript to video with audio (no OpenAI processing)
 * Use this after processCodeWithOpenAI() has already been called
 *
 * @param animationScript Already-processed AnimationScript
 * @param audioBuffer Audio buffer to sync with animation
 * @param outputPath Optional custom output path
 * @returns Buffer containing the final video with audio
 */
export declare function renderAnimationScriptToVideo(animationScript: AnimationScript, audioBuffer: Buffer, outputPath?: string): Promise<Buffer>;
/**
 * Generate a video from text using OpenAI and Remotion 2.0
 *
 * @param text The text to process (question, concept, description)
 * @param audioBuffer Optional audio buffer to use instead of generating
 * @param outputPath Optional custom output path
 * @returns Buffer containing the final video with audio
 */
export declare function generateVideoWithRemotion2(text: string, audioBuffer?: Buffer, outputPath?: string): Promise<Buffer>;
/**
 * Legacy function for backward compatibility
 * Redirects to the new 2.0 function
 */
export declare function generateIllustrationVideoWithRemotion(script: string, audioBuffer: Buffer, outputPath?: string): Promise<Buffer>;
//# sourceMappingURL=videoGenerator.d.ts.map