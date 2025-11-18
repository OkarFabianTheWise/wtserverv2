"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVideo = generateVideo;
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const gTTS = require('node-gtts');
const gtts = gTTS('en');
function generateAudioFromText(text, outputPath) {
    return new Promise((resolve, reject) => {
        gtts.save(outputPath, text, () => {
            console.log(`✅ Audio saved to ${outputPath}`);
            resolve();
        });
    });
}
/**
 * Get the duration of the audio.
 */
function getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
        fluent_ffmpeg_1.default.ffprobe(filePath, (err, metadata) => {
            if (err)
                reject(err);
            const duration = metadata.format.duration || 0;
            resolve(duration);
        });
    });
}
/**
 * Split tutorial text into chunks for separate slides.
 */
function splitTextIntoSlides(text, maxChars) {
    const words = text.split(' ');
    const slides = [];
    let slide = '';
    for (const word of words) {
        if ((slide + word).length > maxChars) {
            slides.push(slide.trim());
            slide = '';
        }
        slide += `${word} `;
    }
    if (slide)
        slides.push(slide.trim());
    return slides;
}
/**
 * Create images (slides) from text.
 */
function generateSlides(script, outputDir) {
    return __awaiter(this, void 0, void 0, function* () {
        const { createCanvas } = yield Promise.resolve().then(() => __importStar(require('canvas')));
        const slidesText = splitTextIntoSlides(script, 500);
        const slidePaths = [];
        if (!fs_1.default.existsSync(outputDir)) {
            fs_1.default.mkdirSync(outputDir);
        }
        for (let i = 0; i < slidesText.length; i++) {
            const canvas = createCanvas(1280, 720);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#333333';
            ctx.font = 'bold 36px sans-serif';
            ctx.fillText('Tutorial Slide', 40, 50);
            ctx.font = '24px sans-serif';
            const lines = wrapText(ctx, slidesText[i], 1200);
            lines.forEach((line, j) => ctx.fillText(line, 40, 100 + j * 40));
            const slidePath = path_1.default.join(outputDir, `slide_${i}.png`);
            fs_1.default.writeFileSync(slidePath, canvas.toBuffer('image/png'));
            slidePaths.push(slidePath);
        }
        return slidePaths;
    });
}
/**
 * Turn each slide into a short video clip.
 */
function createSlideVideo(slidePath, outputPath, duration) {
    return new Promise((resolve, reject) => {
        (0, fluent_ffmpeg_1.default)(slidePath)
            .loop(duration)
            .inputOptions(['-framerate 1'])
            .outputOptions([
            '-c:v libx264',
            `-t ${duration}`,
            '-pix_fmt yuv420p',
            '-r 30',
        ])
            .output(outputPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .run();
    });
}
/**
 * Concatenate slide video clips using FFmpeg concat.
 */
function concatSlideVideos(videoPaths, outputPath) {
    const concatListPath = path_1.default.join(__dirname, 'slides', 'file_list.txt');
    const fileList = videoPaths.map(p => `file '${p}'`).join('\n');
    fs_1.default.writeFileSync(concatListPath, fileList);
    return new Promise((resolve, reject) => {
        (0, fluent_ffmpeg_1.default)()
            .input(concatListPath)
            .inputOptions(['-f concat', '-safe 0'])
            .outputOptions(['-c copy'])
            .output(outputPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .run();
    });
}
/**
 * Merge final video with audio.
 */
// function mergeWithAudio(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
//   return new Promise((resolve, reject) => {
//     ffmpeg()
//       .addInput(videoPath)
//       .addInput(audioPath)
//       .outputOptions(['-shortest', '-c:v copy', '-c:a aac'])
//       .output(outputPath)
//       .on('end', () => resolve())
//       .on('error', (err) => reject(err))
//       .run();
//   });
// }
function mergeWithAudio(videoPath, audioPath, outputPath) {
    return new Promise((resolve, reject) => {
        (0, fluent_ffmpeg_1.default)()
            .addInput(videoPath)
            .addInput(audioPath)
            .outputOptions([
            '-shortest',
            '-c:v copy',
            '-c:a aac',
            '-b:a 192k', // ✅ added bitrate for audio
            '-movflags +faststart' // ✅ helps audio start faster in some players
        ])
            .output(outputPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .run();
    });
}
/**
 * Utility to wrap text for slides.
 */
function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
        const testLine = line + word + ' ';
        const width = ctx.measureText(testLine).width;
        if (width > maxWidth && line !== '') {
            lines.push(line.trim());
            line = word + ' ';
        }
        else {
            line = testLine;
        }
    }
    lines.push(line.trim());
    return lines;
}
/**
 * Main function to generate the full tutorial video.
 */
// export async function generateVideo(tutorialText: string, audioPath: string, finalOutputPath: string): Promise<void> {
//   const outputDir = path.join(__dirname, 'slides');
//   const tempClipsDir = path.join(outputDir, 'clips');
//   if (!fs.existsSync(tempClipsDir)) {
//     fs.mkdirSync(tempClipsDir, { recursive: true });
//   }
//   try {
//     const slides = await generateSlides(tutorialText, outputDir);
//     const audioDuration = await getAudioDuration(audioPath);
//     const durationPerSlide = audioDuration / slides.length;
//     const videoClips: string[] = [];
//     for (let i = 0; i < slides.length; i++) {
//       const videoClipPath = path.join(tempClipsDir, `clip_${i}.mp4`);
//       await createSlideVideo(slides[i], videoClipPath, durationPerSlide);
//       videoClips.push(videoClipPath);
//     }
//     const concatVideoPath = path.join(outputDir, 'combined.mp4');
//     await concatSlideVideos(videoClips, concatVideoPath);
//     await mergeWithAudio(concatVideoPath, audioPath, finalOutputPath);
//     console.log(`✅ Final tutorial video saved to: ${finalOutputPath}`);
//     // Cleanup temporary files
//     [...slides, ...videoClips, concatVideoPath].forEach(file => fs.unlinkSync(file));
//     fs.unlinkSync(path.join(outputDir, 'file_list.txt'));
//     fs.rmdirSync(tempClipsDir);
//     console.log('🧹 Cleaned up temporary files.');
//   } catch (err) {
//     console.error('❌ Error generating video:', err);
//     throw err;
//   }
// }
function generateVideo(tutorialText, audioPath, finalOutputPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const outputDir = path_1.default.join(__dirname, 'slides');
        const tempClipsDir = path_1.default.join(outputDir, 'clips');
        const ttsPath = path_1.default.join(outputDir, 'narration.mp3');
        if (!fs_1.default.existsSync(tempClipsDir)) {
            fs_1.default.mkdirSync(tempClipsDir, { recursive: true });
        }
        try {
            fs_1.default.copyFileSync(audioPath, ttsPath);
            const slides = yield generateSlides(tutorialText, outputDir);
            const audioDuration = yield getAudioDuration(ttsPath);
            const durationPerSlide = audioDuration / slides.length;
            const videoClips = [];
            for (let i = 0; i < slides.length; i++) {
                const videoClipPath = path_1.default.join(tempClipsDir, `clip_${i}.mp4`);
                yield createSlideVideo(slides[i], videoClipPath, durationPerSlide);
                videoClips.push(videoClipPath);
            }
            const concatVideoPath = path_1.default.join(outputDir, 'combined.mp4');
            yield concatSlideVideos(videoClips, concatVideoPath);
            yield mergeWithAudio(concatVideoPath, ttsPath, finalOutputPath);
            console.log(`✅ Final tutorial video saved to: ${finalOutputPath}`);
            // Cleanup
            [...slides, ...videoClips, concatVideoPath, ttsPath].forEach(file => fs_1.default.unlinkSync(file));
            fs_1.default.unlinkSync(path_1.default.join(outputDir, 'file_list.txt'));
            fs_1.default.rmdirSync(tempClipsDir);
            console.log('🧹 Cleaned up temporary files.');
        }
        catch (err) {
            console.error('❌ Error generating video:', err);
            throw err;
        }
    });
}
