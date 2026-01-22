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
 * Sora v3 Video Generation - Simplified API
 * All requests use sora-2 model with intelligent audio handling
 * Narration/explanation is embedded in video (Sora's native sound + optional merge)
 */
/**
 * Generate a video using OpenAI's Sora API (v3)
 * Simple unified function for UI - just send question/script and optional audio
 * Returns job ID for websocket-based progress tracking
 *
 * @param scriptOrQuestion The script or question to generate a video for
 * @param audioBuffer Optional narration audio to merge with video
 * @returns Job ID for tracking video generation progress
 */
export declare function generateVideoWithSora(scriptOrQuestion: string, audioBuffer?: Buffer): Promise<string>;
/**
 * Check the status of a Sora video generation job
 * Use for websocket progress updates
 *
 * @param videoId The job ID returned from generateVideoWithSora
 * @returns Job status with progress information
 */
export declare function getSoraVideoStatus(videoId: string): Promise<{
    id: string;
    status: 'queued' | 'in_progress' | 'completed' | 'failed';
    progress?: number;
    url?: string;
}>;
/**
 * Download completed Sora video as buffer
 * Intelligently handles audio based on Sora's native sound
 *
 * @param videoId The job ID of the completed video
 * @param audioBuffer Optional narration to merge (ignored if Sora video has native sound)
 * @returns Buffer containing the final video (with merged audio if needed)
 */
export declare function downloadSoraVideo(videoId: string, audioBuffer?: Buffer): Promise<Buffer>;
/**
 * Combined function: Generate, poll, and download Sora video
 * Preset to sora-2 model, 8 seconds, intelligent audio handling
 *
 * @param scriptOrQuestion The script or question to generate a video for
 * @param audioBuffer Optional narration/explanation audio to merge
 * @returns Buffer containing the final video
 */
export declare function generateAndDownloadSoraVideo(scriptOrQuestion: string, audioBuffer?: Buffer): Promise<Buffer>;
/**
 * Legacy function for backward compatibility
 * Redirects to the new 2.0 function
 */
export declare function generateIllustrationVideoWithRemotion(script: string, audioBuffer: Buffer, outputPath?: string): Promise<Buffer>;
//# sourceMappingURL=videoGenerator.d.ts.map