/**
 * Sora-OpenAI Integration Example
 * 
 * Demonstrates the complete flow:
 * Question → OpenAI Analysis → Scene Extraction → Sora Video Generation
 * 
 * Run with: npx ts-node src/soraIntegrationExample.ts
 */

import {
    procesQuestionWithSora,
    checkSoraIntegrationStatus,
    downloadSoraIntegrationVideos,
} from './soraIntegration';

/**
 * Example 1: Basic Integration - Single Question
 */
export async function example1_BasicIntegration() {
    console.log('\n📚 EXAMPLE 1: Basic Sora-OpenAI Integration\n');

    try {
        // Step 1: Ask a question
        const question = 'Explain how HTTP requests work using a restaurant analogy';

        // Step 2: Process with OpenAI → Extract scenes → Generate with Sora
        const result = await procesQuestionWithSora(
            question,
            'sora-2',  // Use sora-2 model
            { size: '1280x720' }  // Optional: specify size
        );

        // Step 3: Display results
        console.log('\n📋 INTEGRATION RESULTS');
        console.log('═'.repeat(60));
        console.log('\n🎯 Question:');
        console.log('  ', result.question);

        console.log('\n📝 OpenAI Analysis:');
        console.log('  ', result.openaiAnalysis.summary);
        console.log('  Scenes:', result.openaiAnalysis.script.scenes.length);

        console.log('\n🎬 Sora Generation:');
        console.log('  Scene prompts:', result.soraGeneration.scenePrompts.length);
        console.log('  Video jobs created:', result.soraGeneration.videoJobs.length);

        console.log('\n📌 Generated Video Jobs:');
        result.soraGeneration.videoJobs.forEach((job, i) => {
            console.log(`  ${i + 1}. Job ID: ${job.id}`);
            console.log(`     Status: ${job.status}`);
            console.log(`     Model: ${job.model}`);
        });

        return result;
    } catch (error) {
        console.error('❌ Integration failed:', error instanceof Error ? error.message : error);
    }
}

/**
 * Example 2: Full Workflow with Status Monitoring
 */
export async function example2_FullWorkflowWithMonitoring() {
    console.log('\n📚 EXAMPLE 2: Full Workflow with Status Monitoring\n');

    try {
        // Step 1: Generate with Sora
        const question = 'What is a REST API and how do clients communicate with servers?';

        console.log('🚀 Starting integration workflow...');
        const result = await procesQuestionWithSora(question, 'sora-2');

        // Step 2: Check status periodically
        console.log('\n⏰ Waiting for videos to generate...');
        console.log('Note: Video generation typically takes 10-60 seconds');

        // Check status after 5 seconds
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log('\n📊 Checking video statuses...');
        const statusCheck = await checkSoraIntegrationStatus(result);

        console.log('\n✅ Status Update:');
        console.log('  Total:', statusCheck.totalVideos);
        console.log('  Completed:', statusCheck.completed);
        console.log('  In Progress:', statusCheck.inProgress);
        console.log('  Queued:', statusCheck.queued);
        console.log('  Failed:', statusCheck.failed);

        return result;
    } catch (error) {
        console.error('❌ Workflow failed:', error instanceof Error ? error.message : error);
    }
}

/**
 * Example 3: Download Completed Videos
 */
export async function example3_DownloadVideos() {
    console.log('\n📚 EXAMPLE 3: Download Completed Videos\n');

    try {
        // Step 1: Generate videos
        const question = 'Explain database transactions with a banking example';

        console.log('🚀 Generating videos...');
        const result = await procesQuestionWithSora(question, 'sora-2');

        // Step 2: Wait for completion (in real scenario, would poll periodically)
        console.log('\n⏳ Waiting 30 seconds for at least some videos to complete...');
        await new Promise(resolve => setTimeout(resolve, 30000));

        // Step 3: Download completed videos
        console.log('\n📥 Attempting to download completed videos...');
        const videos = await downloadSoraIntegrationVideos(result);

        console.log('\n✅ Download Results:');
        console.log('  Downloaded videos:', Object.keys(videos).length);
        Object.entries(videos).forEach(([jobId, buffer]) => {
            console.log(`  • ${jobId}: ${buffer.length} bytes`);
        });

        return { result, videos };
    } catch (error) {
        console.error('❌ Download failed:', error instanceof Error ? error.message : error);
    }
}

/**
 * Example 4: Multiple Questions in Sequence
 */
export async function example4_MultipleQuestions() {
    console.log('\n📚 EXAMPLE 4: Process Multiple Questions\n');

    const questions = [
        'Explain DNS lookup process',
        'How does TCP handshake work',
        'What is SSL/TLS encryption',
    ];

    const results = [];

    for (let i = 0; i < questions.length; i++) {
        try {
            console.log(`\n[${i + 1}/${questions.length}] Processing: ${questions[i]}`);
            console.log('─'.repeat(60));

            const result = await procesQuestionWithSora(
                questions[i],
                'sora-2',
                { size: '1280x720' }
            );

            results.push(result);

            console.log(`✅ Completed: Generated ${result.soraGeneration.videoJobs.length} videos`);

            // Small delay between requests
            if (i < questions.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (error) {
            console.error(`❌ Failed to process "${questions[i]}":`,
                error instanceof Error ? error.message : error);
        }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📊 BATCH PROCESSING SUMMARY');
    console.log('─'.repeat(60));
    console.log('Total questions processed:', results.length);
    console.log('Total videos generated:', results.reduce((sum, r) => sum + r.soraGeneration.videoJobs.length, 0));

    return results;
}

/**
 * Example 5: Custom Sora Options
 */
export async function example5_CustomSoraOptions() {
    console.log('\n📚 EXAMPLE 5: Using Custom Sora Options\n');

    try {
        const question = 'Explain how cloud storage works with file synchronization';

        console.log('🚀 Processing with custom Sora options...');
        const result = await procesQuestionWithSora(
            question,
            'sora-2-pro',  // Use pro model for higher quality
            {
                size: '1280x720',  // Standard HD
                webhookUrl: 'https://your-domain.com/webhook/sora-complete',  // Optional webhook
            }
        );

        console.log('\n✅ Integration complete with custom options:');
        console.log('  Model: sora-2-pro');
        console.log('  Size: 1280x720');
        console.log('  Videos generated:', result.soraGeneration.videoJobs.length);

        return result;
    } catch (error) {
        console.error('❌ Custom integration failed:', error instanceof Error ? error.message : error);
    }
}

/**
 * Main: Run all examples or specific one
 */
async function main() {
    const args = process.argv.slice(2);
    const exampleNum = args[0] ? parseInt(args[0]) : 1;

    console.log('\n🎬 SORA-OPENAI INTEGRATION EXAMPLES\n');
    console.log('Available examples:');
    console.log('  1 - Basic Integration');
    console.log('  2 - Full Workflow with Monitoring');
    console.log('  3 - Download Videos');
    console.log('  4 - Multiple Questions');
    console.log('  5 - Custom Sora Options');
    console.log('\nUsage: npx ts-node src/soraIntegrationExample.ts [example-number]');

    switch (exampleNum) {
        case 1:
            await example1_BasicIntegration();
            break;
        case 2:
            await example2_FullWorkflowWithMonitoring();
            break;
        case 3:
            await example3_DownloadVideos();
            break;
        case 4:
            await example4_MultipleQuestions();
            break;
        case 5:
            await example5_CustomSoraOptions();
            break;
        default:
            console.log(`\n❌ Example ${exampleNum} not found`);
            console.log('Please use 1-5');
    }
}

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}
