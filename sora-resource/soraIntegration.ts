/**
 * Integrated Sora-OpenAI Processor
 * 
 * Flow:
 * 1. User asks a question
 * 2. Process with OpenAI to explain using natural scenario analogies
 * 3. Extract Sora scene prompts from the animation script
 * 4. Feed prompts to Sora for video generation
 */

import { processCodeWithOpenAI, AnimationScript } from './openaiProcessor';
import { createSoraVideo, SoraGenerationOptions, VideoJobStatus } from './soraProcessor';

/**
 * Scene prompt for Sora generation extracted from an animation scene
 */
export interface SoraScenePrompt {
    sceneId: string | number;
    prompt: string;
    description: string;
    startTime: number;
    endTime: number;
    duration: number; // in seconds
}

/**
 * Complete integration result with both animation and video generation
 */
export interface SoraIntegrationResult {
    question: string;
    openaiAnalysis: {
        script: AnimationScript;
        summary: string;
    };
    soraGeneration: {
        scenePrompts: SoraScenePrompt[];
        videoJobs: VideoJobStatus[];
    };
}

/**
 * Extract Sora scene prompts from OpenAI animation script
 * Converts animation scenes into descriptive prompts for Sora video generation
 * 
 * @param script The AnimationScript from OpenAI
 * @returns Array of scene prompts ready for Sora
 */
export function extractSoraScenePrompts(script: AnimationScript): SoraScenePrompt[] {
    const scenePrompts: SoraScenePrompt[] = [];

    for (const scene of script.scenes) {
        // Build a descriptive prompt from scene elements and context
        const elementDescriptions = scene.elements.map(el => {
            let description = `${el.name}`;
            if (el.emotion) description += ` (looking ${el.emotion})`;
            if (el.status) description += ` (status: ${el.status})`;
            if (el.content) description += ` saying "${el.content}"`;
            return description;
        });

        // Create the Sora prompt combining description and visual elements
        const prompt = `
${scene.description}

Visual elements:
${elementDescriptions.join('\n')}

Style: ${script.style.theme} theme with ${script.style.primaryColor} as primary color.
Mood: ${determineMoodFromScene(scene)}
`.trim();

        const durationSeconds = (scene.endTime - scene.startTime) / 1000;

        // Map to valid Sora durations: 4, 8, or 12 seconds
        // Round to nearest valid duration
        let soraValidDuration = 4;
        if (durationSeconds <= 6) {
            soraValidDuration = 4;
        } else if (durationSeconds <= 10) {
            soraValidDuration = 8;
        } else {
            soraValidDuration = 12;
        }

        scenePrompts.push({
            sceneId: scene.id,
            prompt,
            description: scene.description,
            startTime: scene.startTime,
            endTime: scene.endTime,
            duration: soraValidDuration, // Sora only supports 4, 8, or 12 seconds
        });
    }

    return scenePrompts;
}

/**
 * Determine mood/tone from scene elements
 */
function determineMoodFromScene(scene: any): string {
    const emotions = scene.elements
        .map((el: any) => el.emotion)
        .filter((e: any) => e);

    const emotions_set = new Set(emotions);

    if (emotions_set.has('happy')) return 'uplifting and positive';
    if (emotions_set.has('sad')) return 'somber and thoughtful';
    if (emotions_set.has('excited')) return 'energetic and dynamic';
    if (emotions_set.has('confused')) return 'puzzling and mysterious';

    return 'neutral and professional';
}

/**
 * Main integration function: Process question → Generate animation → Create Sora videos
 * 
 * @param question User's question to explain
 * @param soraModel Which Sora model to use (default: 'sora-2')
 * @param soraOptions Additional Sora generation options
 * @returns Complete integration result with scripts and video jobs
 */
export async function procesQuestionWithSora(
    question: string,
    soraModel: 'sora-2' | 'sora-2-pro' = 'sora-2',
    soraOptions?: Partial<SoraGenerationOptions>
): Promise<SoraIntegrationResult> {
    console.log('\n🚀 SORA-OPENAI INTEGRATION FLOW');
    console.log('═'.repeat(60));

    // Step 1: Process question with OpenAI
    console.log('\n📝 Step 1: Processing question with OpenAI');
    console.log('─'.repeat(60));
    console.log('Question:', question);

    let script: AnimationScript;
    try {
        script = await processCodeWithOpenAI(question);
        console.log('✅ OpenAI processing complete');
        console.log('   Scenes generated:', script.scenes.length);
        console.log('   Duration:', script.totalDuration, 'ms');
        console.log('   Voiceover:', script.voiceover.text.substring(0, 100) + '...');
    } catch (error) {
        throw new Error(`OpenAI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Step 2: Extract Sora scene prompts
    console.log('\n🎬 Step 2: Extracting Sora scene prompts');
    console.log('─'.repeat(60));

    let scenePrompts: SoraScenePrompt[];
    try {
        scenePrompts = extractSoraScenePrompts(script);
        console.log('✅ Extracted', scenePrompts.length, 'scene prompts');
        scenePrompts.forEach((sp, i) => {
            console.log(`   Scene ${i + 1} (${sp.duration}s):`, sp.description);
        });
    } catch (error) {
        throw new Error(`Scene prompt extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Step 3: Generate Sora videos for each scene
    console.log('\n🎥 Step 3: Generating Sora videos');
    console.log('─'.repeat(60));

    const videoJobs: VideoJobStatus[] = [];
    for (let i = 0; i < scenePrompts.length; i++) {
        const scenePrompt = scenePrompts[i];

        try {
            console.log(`\nGenerating video for scene ${i + 1}/${scenePrompts.length}...`);
            console.log('  Description:', scenePrompt.description);
            console.log('  Duration:', scenePrompt.duration, 'seconds');

            const videoJob = await createSoraVideo({
                prompt: scenePrompt.prompt,
                model: soraModel,
                seconds: scenePrompt.duration,
                size: '1280x720',
                ...soraOptions,
            });

            videoJobs.push(videoJob);
            console.log('✅ Video job created');
            console.log('  Job ID:', videoJob.id);
            console.log('  Status:', videoJob.status);
        } catch (error) {
            console.error(`❌ Failed to generate video for scene ${i + 1}:`,
                error instanceof Error ? error.message : 'Unknown error');
            // Continue with next scene instead of failing completely
            continue;
        }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('✅ INTEGRATION COMPLETE');
    console.log(`Generated ${videoJobs.length} video jobs from ${scenePrompts.length} scenes`);

    return {
        question,
        openaiAnalysis: {
            script,
            summary: `Explained "${question}" with ${script.scenes.length} scenes and ${script.totalDuration}ms duration`,
        },
        soraGeneration: {
            scenePrompts,
            videoJobs,
        },
    };
}

/**
 * Check status of all videos from an integration
 */
export async function checkSoraIntegrationStatus(result: SoraIntegrationResult): Promise<any> {
    console.log('\n📊 Checking integration status...');
    console.log('─'.repeat(60));

    const { getVideoStatus } = await import('./soraProcessor');

    const statusUpdates = await Promise.all(
        result.soraGeneration.videoJobs.map(job =>
            getVideoStatus(job.id).catch(err => ({
                id: job.id,
                status: 'error',
                error: err instanceof Error ? err.message : 'Unknown error',
            }))
        )
    );

    const summary = {
        totalScenes: result.soraGeneration.scenePrompts.length,
        totalVideos: result.soraGeneration.videoJobs.length,
        completed: statusUpdates.filter(s => s.status === 'completed').length,
        inProgress: statusUpdates.filter(s => s.status === 'in_progress').length,
        queued: statusUpdates.filter(s => s.status === 'queued').length,
        failed: statusUpdates.filter(s => s.status === 'failed').length,
        statuses: statusUpdates,
    };

    console.log('\nStatus Summary:');
    console.log('  Completed:', summary.completed);
    console.log('  In Progress:', summary.inProgress);
    console.log('  Queued:', summary.queued);
    console.log('  Failed:', summary.failed);

    return summary;
}

/**
 * Download all completed videos from an integration result
 */
export async function downloadSoraIntegrationVideos(
    result: SoraIntegrationResult
): Promise<{ [jobId: string]: Buffer }> {
    console.log('\n📥 Downloading integration videos...');
    console.log('─'.repeat(60));

    const { getVideoStatus, downloadVideoContent } = await import('./soraProcessor');

    const videos: { [jobId: string]: Buffer } = {};

    for (const job of result.soraGeneration.videoJobs) {
        try {
            const status = await getVideoStatus(job.id);

            if (status.status !== 'completed') {
                console.log(`⏭️  Skipping ${job.id} (status: ${status.status})`);
                continue;
            }

            console.log(`Downloading ${job.id}...`);
            const buffer = await downloadVideoContent(job.id, 'video');
            videos[job.id] = buffer;
            console.log(`✅ Downloaded ${job.id}: ${buffer.length} bytes`);
        } catch (error) {
            console.error(`❌ Failed to download ${job.id}:`,
                error instanceof Error ? error.message : 'Unknown error');
        }
    }

    return videos;
}

export default {
    procesQuestionWithSora,
    extractSoraScenePrompts,
    checkSoraIntegrationStatus,
    downloadSoraIntegrationVideos,
};
