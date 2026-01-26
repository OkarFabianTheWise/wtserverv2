// import { generateIllustrationVideoWithRemotion } from './remotionVideoGenerator.js';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createCanvas } from 'canvas';
// import { saveScrollImage, saveScrollVideo } from './db.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ffmpegPath = "/usr/bin/ffmpeg";
const ffprobePath = "/usr/bin/ffprobe";
if (fs.existsSync(ffmpegPath))
    ffmpeg.setFfmpegPath(ffmpegPath);
if (fs.existsSync(ffprobePath))
    ffmpeg.setFfprobePath(ffprobePath);
/**
 * Get the duration of the audio with better precision.
 */
function getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                console.error('Error getting audio duration:', err);
                reject(err);
                return;
            }
            const duration = metadata.format.duration || 0;
            // console.log(`🎵 Audio duration detected: ${duration.toFixed(3)}s`);
            resolve(duration);
        });
    });
}
// Removed old splitTextIntoSlides function - now handled directly in generateSlides
/**
 * Enhanced text wrapping utility with better handling
 */
function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
        const testLine = line + (line ? ' ' : '') + word;
        const width = ctx.measureText(testLine).width;
        if (width > maxWidth && line !== '') {
            lines.push(line);
            line = word;
        }
        else {
            line = testLine;
        }
    }
    if (line) {
        lines.push(line);
    }
    return lines;
}
/**
 * FIXED: Create images (slides) from text that fills the entire slide properly
 */
async function generateSlides(script, outputDir) {
    const { createCanvas } = await import('canvas');
    const slidePaths = [];
    let allSlides = [];
    let allWeights = [];
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    // Split text into words for better control
    const words = script.split(' ');
    let currentSlideIndex = 0;
    while (words.length > 0) {
        const canvas = createCanvas(1280, 720);
        const ctx = canvas.getContext('2d');
        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Minimal padding to maximize text area
        const paddingX = 40;
        const paddingY = 40;
        const availableWidth = canvas.width - (2 * paddingX);
        const availableHeight = canvas.height - (2 * paddingY);
        // Calculate optimal font size directly (faster than iterating)
        let fontSize = 28;
        let lineHeight = fontSize * 1.3;
        let maxLines = Math.floor(availableHeight / lineHeight);
        // If not enough space, calculate directly instead of looping
        if (maxLines < 8) {
            fontSize = Math.floor((availableHeight / 8) / 1.3);
            fontSize = Math.max(fontSize, 18);
            lineHeight = fontSize * 1.3;
            maxLines = Math.floor(availableHeight / lineHeight);
        }
        ctx.font = `${fontSize}px Arial, sans-serif`;
        // Fill the slide with as much text as possible
        const lines = [];
        let currentLine = '';
        let wordIndex = 0;
        // Pack text into lines, filling each line completely
        while (wordIndex < words.length && lines.length < maxLines) {
            const word = words[wordIndex];
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const textWidth = ctx.measureText(testLine).width;
            if (textWidth <= availableWidth) {
                currentLine = testLine;
                wordIndex++;
            }
            else {
                // Current line is full, start new line
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                    wordIndex++;
                }
                else {
                    // Single word is too long, break it or use smaller font
                    lines.push(word);
                    wordIndex++;
                }
            }
        }
        // Add the last line if it has content
        if (currentLine && lines.length < maxLines) {
            lines.push(currentLine);
        }
        // Remove the used words from the array
        const usedWords = lines.join(' ').split(' ').length;
        words.splice(0, Math.min(usedWords, words.length));
        // Draw text starting from top and filling downward
        ctx.fillStyle = '#333333';
        ctx.font = `${fontSize}px Arial, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        lines.forEach((line, lineIndex) => {
            const y = paddingY + (lineIndex * lineHeight);
            ctx.fillText(line, paddingX, y);
        });
        // Save the slide
        const slidePath = path.join(outputDir, `slide_${currentSlideIndex}.png`);
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(slidePath, buffer);
        slidePaths.push(slidePath);
        // Store slide text and calculate weight
        const slideText = lines.join(' ');
        allSlides.push(slideText);
        const wordCount = slideText.split(' ').length;
        // console.log(`✅ Created slide ${currentSlideIndex + 1} (${wordCount} words, ${fontSize}px font, ${lines.length} lines filled): "${slideText.substring(0, 60)}..."`);
        currentSlideIndex++;
    }
    // Calculate weights based on word count (more accurate than character count)
    const totalWords = allSlides.reduce((sum, slide) => sum + slide.split(' ').length, 0);
    allWeights = allSlides.map(slide => slide.split(' ').length / totalWords);
    // console.log(`📝 Generated ${allSlides.length} slides, all properly filled with text`);
    return { slides: slidePaths, weights: allWeights };
}
function createSlideVideo(slidePath, outputPath, duration) {
    return new Promise((resolve, reject) => {
        // console.log(`🎬 Creating video clip: ${path.basename(outputPath)} (${duration.toFixed(3)}s)`);
        ffmpeg(slidePath)
            .inputOptions([
            '-loop 1',
            '-framerate 10' // Reduced for faster processing
        ])
            .outputOptions([
            '-c:v libx264',
            `-t ${duration.toFixed(3)}`, // Use precise duration
            '-threads 0', // allow ffmpeg to auto-manage threads for faster encode
            '-pix_fmt yuv420p',
            '-r 10', // Reduced output framerate
            '-preset ultrafast', // Faster encoding
            '-crf 28', // Lower quality for speed
            '-movflags +faststart'
        ])
            .output(outputPath)
            .on('end', () => {
            // console.log(`✅ Video clip created: ${path.basename(outputPath)} (${duration.toFixed(3)}s)`);
            resolve();
        })
            .on('error', (err) => {
            console.error(`❌ Error creating video clip ${path.basename(outputPath)}:`, err);
            reject(err);
        })
            .run();
    });
}
/**
 * FIXED: Concatenate slide video clips with precise timing
 */
function concatSlideVideos(videoPaths, outputPath) {
    const videoDir = path.dirname(videoPaths[0]);
    const concatListPath = path.join(videoDir, 'file_list.txt');
    // Use relative paths for concat (more reliable)
    const fileList = videoPaths.map(p => `file '${path.basename(p)}'`).join('\n');
    fs.writeFileSync(concatListPath, fileList);
    // console.log(`🔗 Concatenating ${videoPaths.length} video clips...`);
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(concatListPath)
            .inputOptions(['-f concat', '-safe 0'])
            .outputOptions([
            '-c:v libx264', // Re-encode for consistency
            '-c:a copy', // Copy audio if any
            '-pix_fmt yuv420p',
            '-r 10', // Reduced framerate
            '-preset ultrafast', // Faster encoding
            '-crf 28', // Lower quality for speed
            '-movflags +faststart',
            '-avoid_negative_ts make_zero'
        ])
            .output(outputPath)
            .on('progress', (progress) => {
            if (progress.percent) {
                // console.log(`⏳ Concatenation progress: ${Math.round(progress.percent)}%`);
            }
        })
            .on('end', () => {
            // console.log(`✅ Video concatenation completed: ${path.basename(outputPath)}`);
            // Clean up the file list
            if (fs.existsSync(concatListPath)) {
                fs.unlinkSync(concatListPath);
            }
            resolve();
        })
            .on('error', (err) => {
            console.error(`❌ Error concatenating videos:`, err);
            // Clean up the file list on error
            if (fs.existsSync(concatListPath)) {
                fs.unlinkSync(concatListPath);
            }
            reject(err);
        })
            .run();
    });
}
/**
 * FIXED: Merge final video with audio ensuring perfect sync with proper delay handling
 */
function mergeWithAudio(videoPath, audioPath, outputPath) {
    return new Promise((resolve, reject) => {
        // console.log(`🎵 Merging video with audio with proper sync...`);
        // First, get both durations to ensure they match
        Promise.all([
            getVideoDuration(videoPath),
            getAudioDuration(audioPath)
        ]).then(([videoDuration, audioDuration]) => {
            // console.log(`📹 Video duration: ${videoDuration.toFixed(3)}s`);
            // console.log(`🎵 Audio duration: ${audioDuration.toFixed(3)}s`);
            ffmpeg()
                .addInput(videoPath)
                .inputOptions(['-itsoffset', '0.1']) // Apply offset to video input
                .addInput(audioPath)
                .outputOptions([
                '-c:v copy', // Copy video stream
                '-c:a aac',
                '-b:a 128k', // Reduce audio bitrate
                '-shortest', // Use shortest input (should be audio)
                '-avoid_negative_ts make_zero',
                '-movflags +faststart',
                '-map 0:v:0', // Video from first input
                '-map 1:a:0', // Audio from second input
                '-vsync cfr', // Constant frame rate
                '-async 1' // Audio sync
            ])
                .output(outputPath)
                .on('progress', (progress) => {
                if (progress.percent) {
                    // console.log(`⏳ Audio merge progress: ${Math.round(progress.percent)}%`);
                }
            })
                .on('end', () => {
                // console.log(`✅ Audio merge completed: ${path.basename(outputPath)}`);
                resolve();
            })
                .on('error', (err) => {
                console.error(`❌ Error merging audio:`, err);
                reject(err);
            })
                .run();
        }).catch(reject);
    });
}
/**
 * Get video duration helper function
 */
function getVideoDuration(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                console.error('Error getting video duration:', err);
                reject(err);
                return;
            }
            const duration = metadata.format.duration || 0;
            resolve(duration);
        });
    });
}
/**
 * FIXED: Main function with better synchronization logic
 */
export async function generateVideo(tutorialText, audioPath, finalOutputPath) {
    const outputDir = path.join(__dirname, 'slides');
    const tempClipsDir = path.join(outputDir, 'clips');
    const ttsPath = path.join(outputDir, 'narration.mp3');
    if (!fs.existsSync(tempClipsDir)) {
        fs.mkdirSync(tempClipsDir, { recursive: true });
    }
    try {
        // console.log('🚀 Starting video generation...');
        // Copy audio file
        fs.copyFileSync(audioPath, ttsPath);
        // console.log('📋 Audio file copied');
        // Get actual audio duration FIRST
        const actualAudioDuration = await getAudioDuration(ttsPath);
        // console.log(`⏱️  Actual audio duration: ${actualAudioDuration.toFixed(3)}s`);
        // Generate slides with weights
        const { slides, weights } = await generateSlides(tutorialText, outputDir);
        // console.log(`📊 Generated ${slides.length} slides`);
        // Calculate precise durations based on actual audio length with extra buffer
        const slideDurations = weights.map(weight => {
            const baseDuration = weight * actualAudioDuration;
            // Add 30% buffer to each slide to slow down transitions more
            const bufferedDuration = baseDuration * 1.3;
            return bufferedDuration;
        });
        // Since we added buffers, we need to normalize to fit actual audio duration
        const totalBufferedDuration = slideDurations.reduce((sum, duration) => sum + duration, 0);
        const scaleFactor = actualAudioDuration / totalBufferedDuration;
        const finalSlideDurations = slideDurations.map(duration => duration * scaleFactor);
        // Verify total duration matches
        // const totalCalculatedDuration = finalSlideDurations.reduce((sum, duration) => sum + duration, 0);
        // console.log(`🧮 Calculated total duration: ${totalCalculatedDuration.toFixed(3)}s`);
        // console.log(`🎵 Actual audio duration: ${actualAudioDuration.toFixed(3)}s`);
        // console.log(`📏 Duration difference: ${Math.abs(totalCalculatedDuration - actualAudioDuration).toFixed(3)}s`);
        // console.log('⏱️  Slide durations (with 30% buffer):');
        finalSlideDurations.forEach((duration, i) => {
            // console.log(`   Slide ${i + 1}: ${duration.toFixed(3)}s (${(weights[i] * 100).toFixed(1)}% base + buffer)`);
        });
        // Create video clips for each slide with buffered durations
        const concurrency = Math.max(2, Math.min(16, os.cpus().length || 2));
        const videoClips = new Array(slides.length);
        let currentIndex = 0;
        await new Promise((resolve, reject) => {
            let active = 0;
            let errored = false;
            function next() {
                if (errored)
                    return;
                if (currentIndex >= slides.length && active === 0) {
                    resolve();
                    return;
                }
                while (active < concurrency && currentIndex < slides.length) {
                    const i = currentIndex++;
                    active++;
                    const videoClipPath = path.join(tempClipsDir, `clip_${i}.mp4`);
                    createSlideVideo(slides[i], videoClipPath, finalSlideDurations[i])
                        .then(() => {
                        videoClips[i] = videoClipPath;
                        active--;
                        next();
                    })
                        .catch(err => {
                        errored = true;
                        reject(err);
                    });
                }
            }
            next();
        });
        // Concatenate all video clips
        const concatVideoPath = path.join(outputDir, 'combined.mp4');
        await concatSlideVideos(videoClips, concatVideoPath);
        // Verify concatenated video duration
        // const finalVideoDuration = await getVideoDuration(concatVideoPath);
        // console.log(`📹 Final video duration: ${finalVideoDuration.toFixed(3)}s`);
        // Merge with audio
        await mergeWithAudio(concatVideoPath, ttsPath, finalOutputPath);
        // console.log(`✅ Final tutorial video saved to: ${finalOutputPath}`);
        // Cleanup temporary files
        const filesToCleanup = [
            ...slides,
            ...videoClips,
            concatVideoPath,
            ttsPath
        ];
        filesToCleanup.forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
        if (fs.existsSync(tempClipsDir)) {
            fs.rmdirSync(tempClipsDir);
        }
        // console.log('🧹 Cleaned up temporary files.');
        // console.log('🎉 Video generation completed successfully!');
    }
    catch (err) {
        console.error('❌ Error generating video:', err);
        // Cleanup on error
        try {
            if (fs.existsSync(tempClipsDir)) {
                fs.readdirSync(tempClipsDir).forEach(file => {
                    fs.unlinkSync(path.join(tempClipsDir, file));
                });
                fs.rmdirSync(tempClipsDir);
            }
        }
        catch (cleanupErr) {
            console.error('Error during cleanup:', cleanupErr);
        }
        throw err;
    }
}
/**
 * Generate scrolling script video and return as buffer (for database storage)
 * Uses OS temp directory for ffmpeg processing, then cleans up automatically
 * Ephemeral-compatible: uses ephemeral /tmp directory with immediate cleanup
 */
/**
 * Generate a scrolling video from script + audio
 */
export async function generateScrollingScriptVideo(script, audioPath, outputPath) {
    const width = 1280;
    const height = 720;
    const paddingX = 80;
    const paddingY = 60;
    const fontSize = 28;
    const lineSpacing = 1.8;
    const fontFamily = 'Arial, sans-serif';
    const textColor = '#222';
    const bgColor = '#fff';
    // Measure text
    const dummyCanvas = createCanvas(width, height);
    const ctx = dummyCanvas.getContext('2d');
    ctx.font = `${fontSize}px ${fontFamily}`;
    const paragraphs = script.split(/\n\s*\n/);
    const wrappedLines = [];
    const sections = [];
    let currentLine = 0;
    paragraphs.forEach((paragraph, pIndex) => {
        if (pIndex > 0) {
            wrappedLines.push('');
            currentLine++;
        }
        const lines = paragraph.split(/\n/);
        let complexity = 0;
        lines.forEach(line => {
            if (!line.trim()) {
                wrappedLines.push('');
                currentLine++;
                return;
            }
            const words = line.split(' ');
            const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
            const hasCode = /[(){}\[\]<>]/.test(line);
            const hasTech = /\b(function|class|const|let|var|import|export|async|await)\b/.test(line);
            complexity += avgWordLength * (hasCode ? 1.5 : 1) * (hasTech ? 1.3 : 1);
            let currentLineText = '';
            words.forEach(word => {
                const testLine = currentLineText ? `${currentLineText} ${word}` : word;
                if (ctx.measureText(testLine).width <= width - 2 * paddingX) {
                    currentLineText = testLine;
                }
                else {
                    if (currentLineText)
                        wrappedLines.push(currentLineText);
                    currentLine++;
                    currentLineText = word;
                }
            });
            if (currentLineText) {
                wrappedLines.push(currentLineText);
                currentLine++;
            }
        });
        sections.push({ startLine: currentLine - lines.length, endLine: currentLine - 1, complexity });
        if (pIndex < paragraphs.length - 1) {
            wrappedLines.push('');
            currentLine++;
        }
    });
    const lineHeight = fontSize * lineSpacing;
    const totalHeight = wrappedLines.length * lineHeight + 2 * paddingY + height;
    // console.log(`📝 Processed ${paragraphs.length} paragraphs, ${sections.length} sections, ${wrappedLines.length} lines, total height: ${totalHeight}px`);
    // Create tall canvas
    const canvas = createCanvas(width, totalHeight);
    const scrollCtx = canvas.getContext('2d');
    scrollCtx.fillStyle = bgColor;
    scrollCtx.fillRect(0, 0, width, totalHeight);
    scrollCtx.font = `${fontSize}px ${fontFamily}`;
    scrollCtx.fillStyle = textColor;
    scrollCtx.textBaseline = 'top';
    wrappedLines.forEach((line, i) => {
        if (line.trim())
            scrollCtx.fillText(line, paddingX, paddingY + i * lineHeight);
    });
    const tallImagePath = outputPath.replace(/\.mp4$/, '_scroll.png');
    fs.writeFileSync(tallImagePath, canvas.toBuffer('image/png'));
    // Validate tall image
    const imageStats = fs.statSync(tallImagePath);
    // console.log(`🖼️  Tall image created: ${imageStats.size} bytes, ${width}x${totalHeight}px`);
    if (imageStats.size < 10000) { // Less than 10KB is probably corrupted
        throw new Error(`Tall image too small: ${imageStats.size} bytes`);
    }
    const duration = await getAudioDuration(audioPath);
    // console.log(`🎵 Audio duration for scrolling: ${duration.toFixed(3)}s`);
    // Create scrolling video from tall image
    const tempVideoPath = outputPath.replace(/\.mp4$/, '_video.mp4');
    // Simple scrolling expression (linear)
    const scrollExpression = `${paddingY}+(t/${duration})*(${totalHeight - height - paddingY})`;
    // console.log(`📜 Scroll expression: ${scrollExpression}`);
    await new Promise((resolve, reject) => {
        ffmpeg(tallImagePath)
            .inputOptions(['-framerate 15', '-loop 1'])
            .videoFilters([{ filter: 'crop', options: { w: width, h: height, x: '0', y: scrollExpression } }])
            .outputOptions(['-c:v libx264', '-pix_fmt yuv420p', '-preset ultrafast', '-r 15', `-t ${duration + 0.1}`, '-crf 24', '-y'])
            .save(tempVideoPath)
            .on("end", () => {
            // console.log(`✅ Temp scroll video created: ${tempVideoPath}`);
            resolve();
        })
            .on('error', (err) => {
            console.error('❌ Error creating scroll video:', err);
            reject(err);
        });
    });
    // Validate temp video (don't throw on failure, just warn)
    try {
        const tempVideoDuration = await getVideoDuration(tempVideoPath);
        // console.log(`📹 Temp video duration: ${tempVideoDuration.toFixed(3)}s (expected: ${duration.toFixed(3)}s)`);
    }
    catch (err) {
        console.error('❌ Temp video validation failed:', err);
    }
    // Merge with audio (simplified)
    await new Promise((resolve, reject) => {
        ffmpeg()
            .input(tempVideoPath)
            .input(audioPath)
            .outputOptions([
            '-c:v copy', // Copy video stream
            '-c:a aac', // Encode audio as AAC
            '-b:a 128k',
            '-shortest', // Use shortest input duration
            '-vsync cfr', // Constant frame rate
            '-movflags +faststart', // Put moov atom at beginning
            '-y' // Overwrite output
        ])
            .save(outputPath)
            .on("end", () => {
            // console.log(`✅ Final video merged with audio: ${outputPath}`);
            resolve();
        })
            .on('error', (err) => {
            console.error('❌ Error merging audio:', err);
            reject(err);
        });
    });
    // Validate final video
    try {
        const finalVideoDuration = await getVideoDuration(outputPath);
        // console.log(`📹 Final video duration: ${finalVideoDuration.toFixed(3)}s`);
        if (finalVideoDuration < duration * 0.5) {
            throw new Error(`Final video too short: ${finalVideoDuration}s vs expected ${duration}s`);
        }
    }
    catch (err) {
        console.error('❌ Final video validation failed:', err);
        throw err;
    }
    // Cleanup temp files
    fs.unlinkSync(tallImagePath);
    fs.unlinkSync(tempVideoPath);
    // console.log(`✅ Scrolling video created at ${outputPath}`);
}
export async function generateScrollingScriptVideoBuffer(script, audioBuffer) {
    // console.log('🎬 Generating scrolling script video with slides and audio...');
    const tempDir = os.tmpdir();
    const tempId = `video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const audioPath = path.join(tempDir, `${tempId}.mp3`);
    const outputPath = path.join(tempDir, `${tempId}_output.mp4`);
    try {
        // Write audio buffer to temp file
        fs.writeFileSync(audioPath, audioBuffer);
        // Generate video with slides from script
        await generateVideo(script, audioPath, outputPath);
        // Read the final video buffer
        const videoBuffer = fs.readFileSync(outputPath);
        // Clean up temp files
        try {
            fs.unlinkSync(audioPath);
        }
        catch (err) {
            // Ignore cleanup errors
        }
        try {
            fs.unlinkSync(outputPath);
        }
        catch (err) {
            // Ignore cleanup errors
        }
        return videoBuffer;
    }
    catch (error) {
        // Clean up temp files on error
        try {
            if (fs.existsSync(audioPath))
                fs.unlinkSync(audioPath);
        }
        catch (err) {
            // Ignore cleanup errors
        }
        try {
            if (fs.existsSync(outputPath))
                fs.unlinkSync(outputPath);
        }
        catch (err) {
            // Ignore cleanup errors
        }
        throw error;
    }
}
//# sourceMappingURL=videoGenerator.js.map