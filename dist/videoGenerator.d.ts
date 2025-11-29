/**
 * FIXED: Main function with better synchronization logic
 */
export declare function generateVideo(tutorialText: string, audioPath: string, finalOutputPath: string): Promise<void>;
/**
 * Generate a scrolling script video that matches the audio duration.
 * The script will scroll from bottom to top, teleprompter style.
 */
export declare function generateScrollingScriptVideo(script: string, audioPath: string, outputPath: string): Promise<void>;
/**
 * Generate scrolling script video and return as buffer (for database storage)
 * Uses OS temp directory for ffmpeg processing, then cleans up automatically
 * Heroku-compatible: uses ephemeral /tmp directory with immediate cleanup
 */
export declare function generateScrollingScriptVideoBuffer(script: string, audioBuffer: Buffer): Promise<Buffer>;
//# sourceMappingURL=videoGenerator.d.ts.map