/**
 * Remotion 2.0 Video Generator
 * Generates videos from AnimationScripts using the working Remotion 2D rendering system
 * Adapted from the remotion-sora-implementation-example
 */
import { renderMedia, selectComposition } from '@remotion/renderer';
import { bundle } from '@remotion/bundler';
import path from 'path';
import fs from 'fs';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import OpenAI from 'openai';
import { processCodeWithOpenAI, msToFrames } from './openaiProcessor.js';
const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Set ffmpeg path if available
const ffmpegPath = '/usr/bin/ffmpeg';
const ffprobePath = '/usr/bin/ffprobe';
if (fs.existsSync(ffmpegPath))
    ffmpeg.setFfmpegPath(ffmpegPath);
if (fs.existsSync(ffprobePath))
    ffmpeg.setFfprobePath(ffprobePath);
/**
 * Get audio duration using ffprobe
 */
function getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                console.warn('⚠️ Warning getting audio duration, using default:', err.message);
                resolve(60); // Default fallback
                return;
            }
            const duration = metadata.format.duration || 60;
            console.log(`🎵 Audio duration detected: ${duration.toFixed(3)}s`);
            resolve(duration);
        });
    });
}
/**
 * Merge audio and video into a single MP4 file with synchronized audio
 */
async function mergeAudioWithVideo(videoPath, audioPath, outputPath) {
    try {
        // Verify files exist before processing
        if (!fs.existsSync(videoPath)) {
            throw new Error(`Video file not found: ${videoPath}`);
        }
        if (!fs.existsSync(audioPath)) {
            throw new Error(`Audio file not found: ${audioPath}`);
        }
        console.log('🎵 Merging audio with video using FFmpeg...');
        console.log('   Video:', videoPath);
        console.log('   Audio:', audioPath);
        console.log('   Output:', outputPath);
        const args = [
            '-i', videoPath,
            '-i', audioPath,
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-map', '0:v:0',
            '-map', '1:a:0',
            '-shortest',
            '-y',
            outputPath
        ];
        console.log('   ▶️ FFmpeg command: ffmpeg', args.join(' '));
        const { stdout, stderr } = await execFileAsync('ffmpeg', args);
        if (stderr) {
            console.log('   📊 FFmpeg output:', stderr.substring(0, 200));
        }
        console.log('✅ Audio-video merge completed successfully');
        return outputPath;
    }
    catch (error) {
        console.error('❌ FFmpeg error:', error);
        throw error;
    }
}
/**
 * Render an AnimationScript to video with audio (no OpenAI processing)
 * Use this after processCodeWithOpenAI() has already been called
 *
 * @param animationScript Already-processed AnimationScript
 * @param audioBuffer Audio buffer to sync with animation
 * @param outputPath Optional custom output path
 * @returns Buffer containing the final video with audio
 */
export async function renderAnimationScriptToVideo(animationScript, audioBuffer, outputPath) {
    const tempDir = os.tmpdir();
    const tempId = `render-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const audioPath = path.join(tempDir, `${tempId}.mp3`);
    const videoPath = path.join(tempDir, `${tempId}.mp4`);
    const finalVideoPath = path.join(tempDir, `${tempId}_final.mp4`);
    try {
        console.log('🎬 Remotion 2.0 Rendering AnimationScript to Video');
        console.log(`📊 Animation Script Details:
      - Duration: ${animationScript.totalDuration}ms (${(animationScript.totalDuration / 1000).toFixed(2)}s)
      - Scenes: ${animationScript.scenes.length}
      - Voiceover: ${animationScript.voiceover.text.length} characters
    `);
        // Write audio buffer to temp file
        fs.writeFileSync(audioPath, audioBuffer);
        console.log('🔊 Audio buffer written to temp file');
        // Get audio duration to sync
        const audioDuration = await getAudioDuration(audioPath);
        console.log(`⏱️ Audio duration: ${audioDuration.toFixed(2)} seconds`);
        // Adjust script duration to match audio
        animationScript.totalDuration = Math.ceil(audioDuration * 1000);
        console.log(`🔄 Animation duration synced to audio: ${animationScript.totalDuration}ms`);
        // Bundle Remotion project
        console.log('📦 Bundling Remotion project...');
        const projectRoot = path.resolve(__dirname, '..', '..');
        const bundleLocation = await bundle({
            entryPoint: path.join(projectRoot, 'src/remotion/RemotionRoot.tsx'),
            webpackOverride: (config) => config,
        });
        console.log('✅ Bundle completed:', bundleLocation);
        // Select composition
        console.log('🎨 Selecting composition...');
        const compositionId = 'AnimationComposition';
        const composition = await selectComposition({
            serveUrl: bundleLocation,
            id: compositionId,
            inputProps: { animationScript },
        });
        console.log(`✅ Composition selected: ${compositionId}`);
        console.log(`   Duration: ${composition.durationInFrames} frames @ ${composition.fps} fps`);
        // Calculate frames based on audio duration
        const durationInFrames = msToFrames(animationScript.totalDuration, composition.fps);
        const updatedComposition = {
            ...composition,
            durationInFrames,
        };
        console.log(`⏱️ Updated composition duration: ${durationInFrames} frames`);
        // Render video
        console.log('🎬 Rendering animation to video...');
        await renderMedia({
            composition: updatedComposition,
            serveUrl: bundleLocation,
            codec: 'h264',
            outputLocation: videoPath,
            inputProps: { animationScript },
        });
        console.log('✅ Video render completed');
        // Verify video file
        if (!fs.existsSync(videoPath)) {
            throw new Error('Video file was not created by Remotion');
        }
        const videoStats = fs.statSync(videoPath);
        console.log(`📹 Video file size: ${(videoStats.size / 1024 / 1024).toFixed(2)} MB`);
        // Merge audio with video
        console.log('🎵 Merging audio with video...');
        await mergeAudioWithVideo(videoPath, audioPath, finalVideoPath);
        // Verify final video
        if (!fs.existsSync(finalVideoPath)) {
            throw new Error('Final video file was not created');
        }
        const finalStats = fs.statSync(finalVideoPath);
        console.log(`✅ Final video created: ${(finalStats.size / 1024 / 1024).toFixed(2)} MB`);
        // Read the final video into buffer
        const finalVideoBuffer = fs.readFileSync(finalVideoPath);
        console.log(`📦 Video buffer size: ${finalVideoBuffer.length} bytes`);
        // Cleanup temp files
        console.log('🧹 Cleaning up temporary files...');
        const tempFiles = [audioPath, videoPath, finalVideoPath];
        for (const file of tempFiles) {
            try {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                    console.log(`   Removed: ${path.basename(file)}`);
                }
            }
            catch (err) {
                console.warn(`   Warning: Could not remove ${file}:`, err);
            }
        }
        console.log('✅ Animation Rendering Completed Successfully');
        return finalVideoBuffer;
    }
    catch (error) {
        console.error('❌ Error rendering animation to video:', error);
        // Cleanup on error
        console.log('🧹 Cleaning up temporary files due to error...');
        const tempFiles = [audioPath, videoPath, finalVideoPath];
        for (const file of tempFiles) {
            try {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                }
            }
            catch (err) {
                // Silently fail cleanup
            }
        }
        throw error;
    }
}
/**
 * Generate a video from text using OpenAI and Remotion 2.0
 *
 * @param text The text to process (question, concept, description)
 * @param audioBuffer Optional audio buffer to use instead of generating
 * @param outputPath Optional custom output path
 * @returns Buffer containing the final video with audio
 */
export async function generateVideoWithRemotion2(text, audioBuffer, outputPath) {
    const tempDir = os.tmpdir();
    const tempId = `remotion2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const audioPath = path.join(tempDir, `${tempId}.mp3`);
    const videoPath = path.join(tempDir, `${tempId}.mp4`);
    const finalVideoPath = path.join(tempDir, `${tempId}_final.mp4`);
    try {
        console.log('🎬 Remotion 2.0 Video Generation Started');
        console.log('📝 Input text length:', text.length, 'characters');
        // Write audio buffer to temp file
        if (audioBuffer) {
            fs.writeFileSync(audioPath, audioBuffer);
            console.log('🔊 Using provided audio buffer');
        }
        else {
            throw new Error('Audio buffer is required for Remotion 2.0 rendering');
        }
        // Get audio duration
        const audioDuration = await getAudioDuration(audioPath);
        console.log(`⏱️ Audio duration: ${audioDuration.toFixed(2)} seconds`);
        // Process text with OpenAI to get AnimationScript
        console.log('🤖 Processing text with OpenAI GPT-4...');
        const animationScript = await processCodeWithOpenAI(text);
        console.log('✅ Animation script generated');
        console.log(`📊 Script details:
      - Composition: ${animationScript.compositionId || 'AnimationComposition'}
      - Total duration: ${animationScript.totalDuration}ms (${(animationScript.totalDuration / 1000).toFixed(2)}s)
      - Scenes: ${animationScript.scenes.length}
      - Voiceover length: ${animationScript.voiceover.text.length} characters
    `);
        // Override the total duration to match audio
        animationScript.totalDuration = Math.ceil(audioDuration * 1000);
        console.log(`🔄 Adjusted animation duration to match audio: ${animationScript.totalDuration}ms`);
        // Bundle Remotion project
        console.log('📦 Bundling Remotion project...');
        const projectRoot = path.resolve(__dirname, '..', '..');
        const bundleLocation = await bundle({
            entryPoint: path.join(projectRoot, 'src/remotion/RemotionRoot.tsx'),
            webpackOverride: (config) => config,
        });
        console.log('✅ Bundle completed:', bundleLocation);
        // Select composition
        console.log('🎨 Selecting composition...');
        // Always use AnimationComposition - it handles all scene types internally
        const compositionId = 'AnimationComposition';
        const composition = await selectComposition({
            serveUrl: bundleLocation,
            id: compositionId,
            inputProps: { animationScript },
        });
        console.log(`✅ Composition selected: ${compositionId}`);
        console.log(`   Duration: ${composition.durationInFrames} frames @ ${composition.fps} fps`);
        // Calculate frames based on audio duration
        const durationInFrames = msToFrames(animationScript.totalDuration, composition.fps);
        const updatedComposition = {
            ...composition,
            durationInFrames,
        };
        console.log(`⏱️ Updated composition duration: ${durationInFrames} frames`);
        // Render video
        console.log('🎬 Rendering video...');
        await renderMedia({
            composition: updatedComposition,
            serveUrl: bundleLocation,
            codec: 'h264',
            outputLocation: videoPath,
            inputProps: { animationScript },
        });
        console.log('✅ Video render completed');
        // Verify video file
        if (!fs.existsSync(videoPath)) {
            throw new Error('Video file was not created by Remotion');
        }
        const videoStats = fs.statSync(videoPath);
        console.log(`📹 Video file size: ${(videoStats.size / 1024 / 1024).toFixed(2)} MB`);
        // Merge audio with video
        console.log('🎵 Merging audio with video...');
        await mergeAudioWithVideo(videoPath, audioPath, finalVideoPath);
        // Verify final video
        if (!fs.existsSync(finalVideoPath)) {
            throw new Error('Final video file was not created');
        }
        const finalStats = fs.statSync(finalVideoPath);
        console.log(`✅ Final video created: ${(finalStats.size / 1024 / 1024).toFixed(2)} MB`);
        // Read the final video into buffer
        const finalVideoBuffer = fs.readFileSync(finalVideoPath);
        console.log(`📦 Video buffer size: ${finalVideoBuffer.length} bytes`);
        // Cleanup temp files
        console.log('🧹 Cleaning up temporary files...');
        const tempFiles = [audioPath, videoPath, finalVideoPath];
        for (const file of tempFiles) {
            try {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                    console.log(`   Removed: ${path.basename(file)}`);
                }
            }
            catch (err) {
                console.warn(`   Warning: Could not remove ${file}:`, err);
            }
        }
        console.log('✅ Remotion 2.0 Video Generation Completed Successfully');
        return finalVideoBuffer;
    }
    catch (error) {
        console.error('❌ Error generating video with Remotion 2.0:', error);
        // Cleanup on error
        console.log('🧹 Cleaning up temporary files due to error...');
        const tempFiles = [audioPath, videoPath, finalVideoPath];
        for (const file of tempFiles) {
            try {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                }
            }
            catch (err) {
                // Silently fail cleanup
            }
        }
        throw error;
    }
}
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
export async function generateVideoWithSora(scriptOrQuestion, audioBuffer) {
    try {
        console.log('🎬 Sora v3 Video Generation Started');
        console.log('📝 Input length:', scriptOrQuestion.length, 'characters');
        console.log('   Model: sora-2 (preset)');
        console.log('   Audio handling: Intelligent (Sora native + optional merge)');
        // Initialize OpenAI client
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || '',
        });
        // Create a prompt for Sora from the script/question
        const soraPrompt = generateSoraPrompt(scriptOrQuestion);
        console.log('🎨 Generated Sora prompt:', soraPrompt.substring(0, 150) + '...');
        // Call Sora API to generate video (always 8 seconds, sora-2 model)
        console.log('📹 Calling Sora API to create video job...');
        const video = await openai.videos.create({
            model: 'sora-2', // Preset to sora-2
            prompt: soraPrompt,
            size: '1280x720', // Standard HD size
            seconds: '8', // Preset to 8 seconds
        });
        const videoId = video.id;
        const status = video.status;
        console.log('✅ Sora video job created');
        console.log('   Job ID:', videoId);
        console.log('   Status:', status);
        // Store audio buffer metadata for later use if provided
        if (audioBuffer) {
            console.log('📝 Audio buffer provided:', audioBuffer.length, 'bytes');
        }
        return videoId;
    }
    catch (error) {
        console.error('❌ Error creating Sora video:', error);
        throw error;
    }
}
/**
 * Check the status of a Sora video generation job
 * Use for websocket progress updates
 *
 * @param videoId The job ID returned from generateVideoWithSora
 * @returns Job status with progress information
 */
export async function getSoraVideoStatus(videoId) {
    try {
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || '',
        });
        console.log('📊 Checking Sora video status:', videoId);
        const video = await openai.videos.retrieve(videoId);
        const status = video.status;
        const url = video.url;
        const progress = video.progress || 0;
        console.log('   Status:', status);
        if (progress)
            console.log('   Progress:', progress, '%');
        return {
            id: videoId,
            status,
            progress,
            url,
        };
    }
    catch (error) {
        console.error('❌ Error checking Sora video status:', error);
        throw error;
    }
}
/**
 * Download completed Sora video as buffer
 * Intelligently handles audio based on Sora's native sound
 *
 * @param videoId The job ID of the completed video
 * @param audioBuffer Optional narration to merge (ignored if Sora video has native sound)
 * @returns Buffer containing the final video (with merged audio if needed)
 */
export async function downloadSoraVideo(videoId, audioBuffer) {
    const tempDir = os.tmpdir();
    const tempId = `sora-download-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const videoPath = path.join(tempDir, `${tempId}.mp4`);
    const audioPath = audioBuffer ? path.join(tempDir, `${tempId}.mp3`) : null;
    const finalVideoPath = audioBuffer ? path.join(tempDir, `${tempId}_final.mp4`) : videoPath;
    try {
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || '',
        });
        console.log('📥 Downloading Sora video...');
        const content = await openai.videos.downloadContent(videoId, 'video');
        const videoBuffer = Buffer.from(await content.arrayBuffer());
        console.log(`✅ Downloaded video: ${videoBuffer.length} bytes`);
        // Write video to temp file
        fs.writeFileSync(videoPath, videoBuffer);
        // Step 2: Check if audio merge is needed
        if (audioBuffer && audioPath) {
            console.log('🎵 Audio buffer provided - checking if merge needed...');
            console.log('   ℹ️  Sora may include native sound');
            console.log('   📝 Merging provided audio for narration/explanation...');
            // Write audio to temp file
            fs.writeFileSync(audioPath, audioBuffer);
            // Merge audio with video
            console.log('🎵 Merging audio with Sora video...');
            await mergeAudioWithVideo(videoPath, audioPath, finalVideoPath);
            console.log('✅ Audio merged successfully');
            // Verify final video
            if (!fs.existsSync(finalVideoPath)) {
                throw new Error('Final video file was not created');
            }
            const finalStats = fs.statSync(finalVideoPath);
            console.log(`📹 Final video size: ${(finalStats.size / 1024 / 1024).toFixed(2)} MB`);
            // Read final video buffer
            const finalVideoBuffer = fs.readFileSync(finalVideoPath);
            // Cleanup
            console.log('🧹 Cleaning up temporary files...');
            [videoPath, audioPath, finalVideoPath].forEach(file => {
                try {
                    if (fs.existsSync(file))
                        fs.unlinkSync(file);
                }
                catch (err) {
                    // Silently fail cleanup
                }
            });
            return finalVideoBuffer;
        }
        else {
            // Use Sora's native sound only
            console.log('✅ Using Sora video with native sound (no additional audio merge)');
            const singleVideoBuffer = fs.readFileSync(videoPath);
            console.log(`📦 Video buffer size: ${singleVideoBuffer.length} bytes`);
            // Cleanup
            try {
                if (fs.existsSync(videoPath))
                    fs.unlinkSync(videoPath);
            }
            catch (err) {
                // Silently fail cleanup
            }
            return singleVideoBuffer;
        }
    }
    catch (error) {
        console.error('❌ Error downloading Sora video:', error);
        // Cleanup on error
        [videoPath, audioPath, finalVideoPath].forEach(file => {
            if (file && fs.existsSync(file)) {
                try {
                    fs.unlinkSync(file);
                }
                catch (err) {
                    // Silently fail cleanup
                }
            }
        });
        throw error;
    }
}
/**
 * Combined function: Generate, poll, and download Sora video
 * Preset to sora-2 model, 8 seconds, intelligent audio handling
 *
 * @param scriptOrQuestion The script or question to generate a video for
 * @param audioBuffer Optional narration/explanation audio to merge
 * @returns Buffer containing the final video
 */
export async function generateAndDownloadSoraVideo(scriptOrQuestion, audioBuffer) {
    try {
        // Step 1: Create video generation job
        console.log('🎬 Sora v3 Video Generation Started (End-to-End)');
        const videoId = await generateVideoWithSora(scriptOrQuestion, audioBuffer);
        // Step 2: Poll for completion
        console.log('⏳ Polling for video generation completion...');
        let status = await getSoraVideoStatus(videoId);
        let attempts = 0;
        const maxAttempts = 120; // Poll for up to 10 minutes (5 second intervals)
        while (status.status !== 'completed' && status.status !== 'failed' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            attempts++;
            status = await getSoraVideoStatus(videoId);
            console.log(`   Poll ${attempts}/${maxAttempts}: Status = ${status.status}`);
        }
        if (status.status === 'failed') {
            throw new Error(`Sora video generation failed after ${attempts} polls`);
        }
        if (status.status !== 'completed') {
            throw new Error(`Sora video generation timeout after ${maxAttempts} polls`);
        }
        // Step 3: Download video with intelligent audio handling
        console.log('📥 Downloading and processing video...');
        const finalVideoBuffer = await downloadSoraVideo(videoId, audioBuffer);
        console.log('✅ Sora v3 Video Generation Completed Successfully');
        return finalVideoBuffer;
    }
    catch (error) {
        console.error('❌ Error in Sora v3 video generation:', error);
        throw error;
    }
}
/**
 * Generate an optimized prompt for Sora from a script or question
 * @param scriptOrQuestion The input text to convert to a Sora prompt
 * @returns Formatted prompt for Sora API
 */
function generateSoraPrompt(scriptOrQuestion) {
    // Limit prompt length for Sora (typically 1000 chars max)
    const maxLength = 1000;
    let prompt = scriptOrQuestion.trim();
    if (prompt.length > maxLength) {
        prompt = prompt.substring(0, maxLength);
        const lastSpace = prompt.lastIndexOf(' ');
        if (lastSpace > 0) {
            prompt = prompt.substring(0, lastSpace);
        }
    }
    // Enhance prompt with visual descriptors if it seems like a technical script
    if (scriptOrQuestion.toLowerCase().includes('code') ||
        scriptOrQuestion.toLowerCase().includes('function') ||
        scriptOrQuestion.toLowerCase().includes('algorithm')) {
        prompt = `Create an educational video showing: ${prompt}. Use clear visual explanations, diagrams, and animations to illustrate concepts. Professional quality, 16:9 aspect ratio.`;
    }
    return prompt;
}
/**
 * Legacy function for backward compatibility
 * Redirects to the new 2.0 function
 */
export async function generateIllustrationVideoWithRemotion(script, audioBuffer, outputPath) {
    console.log('⚠️ Using legacy generateIllustrationVideoWithRemotion - redirecting to 2.0');
    return generateVideoWithRemotion2(script, audioBuffer, outputPath);
}
//# sourceMappingURL=videoGenerator.js.map