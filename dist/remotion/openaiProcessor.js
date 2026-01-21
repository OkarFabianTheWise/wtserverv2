/**
 * Remotion 2.0 OpenAI Processor
 * Adapted from the working remotion-sora-implementation-example
 * Generates AnimationScripts from text input using OpenAI GPT-4
 */
import OpenAI from 'openai';
import fs from 'fs';
const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
});
/**
 * Generate audio voiceover using OpenAI's text-to-speech API
 * @param text The text to convert to speech
 * @param outputPath Path where to save the audio file
 * @returns Path to the generated audio file
 */
export async function generateVoiceover(text, outputPath) {
    try {
        console.log('🎙️  Generating voiceover with OpenAI TTS...');
        const speech = await client.audio.speech.create({
            model: 'tts-1',
            voice: 'alloy', // Options: alloy, echo, finsborg, nova, onyx, shimmer
            input: text,
            speed: 1.0,
        });
        const buffer = Buffer.from(await speech.arrayBuffer());
        fs.writeFileSync(outputPath, buffer);
        console.log('✅ Voiceover generated:', outputPath);
        return outputPath;
    }
    catch (error) {
        console.error('❌ Error generating voiceover:', error);
        throw error;
    }
}
/**
 * Validates that AnimationScript matches expected structure for rendering
 */
function validateAnimationScript(script) {
    if (!script || typeof script !== 'object') {
        throw new Error('AnimationScript must be an object');
    }
    const required = ['totalDuration', 'voiceover', 'scenes', 'style'];
    for (const field of required) {
        if (!(field in script)) {
            throw new Error(`Missing required field: ${field}`);
        }
    }
    // Validate totalDuration
    if (typeof script.totalDuration !== 'number' || script.totalDuration < 10000 || script.totalDuration > 120000) {
        throw new Error(`totalDuration must be between 10000-120000ms, got: ${script.totalDuration}`);
    }
    // Validate voiceover
    if (!script.voiceover || typeof script.voiceover !== 'object') {
        throw new Error('voiceover must be an object');
    }
    if (typeof script.voiceover.text !== 'string' || script.voiceover.text.length === 0) {
        throw new Error('voiceover.text must be a non-empty string');
    }
    if (!Array.isArray(script.voiceover.segments)) {
        throw new Error('voiceover.segments must be an array');
    }
    // Validate scenes
    if (!Array.isArray(script.scenes) || script.scenes.length === 0) {
        throw new Error('scenes must be a non-empty array');
    }
    for (let i = 0; i < script.scenes.length; i++) {
        const scene = script.scenes[i];
        if (typeof scene.startTime !== 'number' || typeof scene.endTime !== 'number') {
            throw new Error(`Scene ${i}: startTime and endTime must be numbers`);
        }
        if (scene.startTime >= scene.endTime) {
            throw new Error(`Scene ${i}: startTime must be less than endTime`);
        }
        if (typeof scene.description !== 'string' || scene.description.length === 0) {
            throw new Error(`Scene ${i}: description must be a non-empty string`);
        }
        if (!Array.isArray(scene.elements)) {
            throw new Error(`Scene ${i}: elements must be an array`);
        }
    }
    // Validate style
    if (!script.style || typeof script.style !== 'object') {
        throw new Error('style must be an object');
    }
    const styleFields = ['backgroundColor', 'primaryColor', 'secondaryColor', 'accentColor', 'fontFamily', 'theme'];
    for (const field of styleFields) {
        if (typeof script.style[field] !== 'string' || script.style[field].length === 0) {
            throw new Error(`style.${field} must be a non-empty string`);
        }
    }
    return script;
}
/**
 * Ensures scenes use valid component types from our library
 */
function normalizeComponentTypes(script) {
    const validCharacters = ['AppCharacter', 'ChefCharacter', 'CustomerCharacter', 'WorkerCharacter'];
    const validBuildings = ['Restaurant', 'Bakery', 'Library', 'Factory'];
    const validBackgrounds = ['CityStreet', 'OfficeBackground', 'CloudBackground'];
    for (const scene of script.scenes) {
        for (const element of scene.elements) {
            // Normalize character types
            if (validCharacters.includes(element.name || '')) {
                element.type = 'character';
            }
            // Normalize building types
            else if (validBuildings.includes(element.name || '')) {
                element.type = 'building';
            }
            // Normalize background types
            else if (validBackgrounds.includes(element.name || '')) {
                element.type = 'background';
            }
            // Default for other types
            else if (!['text', 'messageBox', 'dataPacket', 'background'].includes(element.type)) {
                element.type = 'element';
            }
        }
    }
    return script;
}
/**
 * Ensures all timings are valid and within bounds
 */
function validateTimings(script) {
    // Validate that all scenes fit within totalDuration
    for (const scene of script.scenes) {
        if (scene.endTime > script.totalDuration) {
            throw new Error(`Scene ${scene.id}: endTime (${scene.endTime}ms) exceeds totalDuration (${script.totalDuration}ms)`);
        }
    }
    // Validate voiceover segments
    for (const segment of script.voiceover.segments) {
        if (segment.endTime > script.totalDuration) {
            console.warn(`Voiceover segment endTime (${segment.endTime}ms) exceeds totalDuration (${script.totalDuration}ms), clamping...`);
            segment.endTime = script.totalDuration;
        }
    }
    return script;
}
const SYSTEM_PROMPT = `
You are an expert animator creating educational explanations using ONLY real-world scenarios. NEVER use technical jargon.

CRITICAL: You MUST return ONLY valid JSON in the exact format specified below. No explanation, no markdown, just pure JSON.

GOLDEN RULE - ELIMINATE JARGON:
FORBIDDEN WORDS: request, response, endpoint, HTTP, API, JSON, server, database, function, parameter, argument, status code, error code, payload, data, array, object, variable, string, integer, boolean, method, property, class, interface, callback, async, promise, event, listener, stream
INSTEAD USE: customer, order, dish, chef, kitchen, restaurant, table, tray, confirmation, message, receipt, signal, notification, package, item, instruction, person, action, outcome

TECHNICAL TRANSLATION (RESTAURANT METAPHOR):
- res.json with data = Chef places a confirmation note/receipt on the counter for the customer
- req.params = Information the customer writes on their order ticket
- req.body = The full order details from the customer
- Status 200/201 = Order successfully received and prepared
- Status 404 = Item not found in the kitchen
- Status 403 = You're not allowed to have this dish
- Status 500 = Kitchen emergency, something broke
- Error handling = When something goes wrong, staff tells the customer
- Delete operation = Removing an order from the system, staff confirms it's cleared away
- Success response = Happy confirmation, green notification that everything worked
- Failed response = Sad notification in red that something didn't work

COMPOSITION SELECTION GUIDANCE:
Choose the best composition based on the concept:
- "RestaurantComposition": For order handling, serving, customer interactions, request/response cycles (Chef/Kitchen metaphor)
- "FactoryComposition": For data processing pipelines, build systems, assembly workflows
- "BakeryComposition": For simple step-by-step processes, recipes, small operations
- "AnimationComposition": For anything not fitting above categories

AVAILABLE COMPONENTS (use these EXACTLY):

CHARACTERS: AppCharacter, ChefCharacter, CustomerCharacter, WorkerCharacter
  - Props: name (exact name), x (number 0-1920), y (number 0-1080), emotion (happy/sad/neutral)
  - ChefCharacter ALSO supports: holdingTray (bool), isWalking (bool), walkingDirection ('left'|'right')

BUILDINGS: Restaurant, Bakery, Library, Factory
  - Props: name (exact name), x (number 0-1920), y (number 0-1080), status (open/closed/busy)

BACKGROUNDS: CityStreet, OfficeBackground, CloudBackground
  - Use one per scene

UI ELEMENTS: 
- MessageBox (success/error/info/warning) - for notifications (green for success, red for failure)
- DataPacket - for showing information packages
- LoadingSpinner - for waiting states
- Table - for restaurant scenes, width/height props
- Meal - for served food (type: 'plate' or 'tray')
- OrderTicket - for orders being pending/preparing/ready

ANIMATION RULES:
- Total duration: 30000-60000 milliseconds (30-60 seconds)
- All positions: x (0-1920), y (0-1080)
- All timings: milliseconds, must not exceed totalDuration
- BEAUTIFUL ANIMATIONS: Use flowing, natural movements 500-2000ms per action
- Characters should walk, react with emotions, show satisfaction/confusion
- Build suspense and resolution - show waiting, then celebration or disappointment
- Use MessageBox with success (green) or error (red) for confirmations

NARRATION RULES:
- Speak ONLY in scenario language - describe what the customer sees, hears, experiences
- Never mention ANY technical details - no code, no technical terms, no jargon
- Use storytelling: "A customer walks in... they look around the kitchen... they place their order..."
- Make it conversational and engaging as if narrating a real scene
- Describe emotions and reactions: happy chef dancing, confused customer scratching head, satisfied smile
- Avoid ALL forbidden words in voiceover - use simple everyday language
- Example GOOD narration: "The kitchen team receives the order and starts preparing. The chef is busy stirring the pot. Finally, the dish is ready and placed on the counter with a green confirmation note."
- Example BAD narration: "The API endpoint receives the request and processes the data structure. The server returns a JSON response with status code 200."
- Write as if explaining to a 5-year-old who has never seen a computer
- Narration should match what's animated on screen - describe actions, emotions, and outcomes only

Return JSON in this EXACT format:
{
  "title": "<short, descriptive title based on the concept (3-8 words)>",
  "compositionId": "RestaurantComposition|FactoryComposition|BakeryComposition|AnimationComposition",
  "totalDuration": <number 30000-60000>,
  "voiceover": {
    "text": "<narration using ONLY scenario language, no jargon, tell a story>",
    "segments": [
      {"startTime": <ms>, "endTime": <ms>, "text": "<segment narration - what's happening in the story>"}
    ]
  },
  "scenes": [
    {
      "id": "<string or number>",
      "startTime": <ms>,
      "endTime": <ms>,
      "description": "<what's happening - only scenario terms, never technical>",
      "elements": [
        {
          "name": "<exact component name from list above>",
          "type": "character|building|background|element",
          "x": <0-1920>,
          "y": <0-1080>,
          "emotion": "happy|sad|neutral",
          "status": "open|closed|busy",
          "animation": {
            "from": {"x": <number>, "y": <number>},
            "to": {"x": <number>, "y": <number>},
            "duration": <ms>
          }
        }
      ]
    }
  ],
  "style": {
    "backgroundColor": "#1F2937",
    "primaryColor": "#3B82F6",
    "secondaryColor": "#10B981",
    "accentColor": "#F59E0B",
    "fontFamily": "Inter, sans-serif",
    "theme": "modern"
  }
}

Ensure:
- JSON is valid and complete
- compositionId is one of the 4 options
- All timings are sequential and within totalDuration
- Animations are flowing and beautiful (500-2000ms per transition)
- Characters move and react naturally
- Include emotional responses (happy when success, sad/confused when problems)
- ZERO technical jargon in description and voiceover
- ZERO forbidden words listed above
- Tell a complete story from start to finish
- End with clear success or failure scenario
- Return ONLY JSON, nothing else
`;
/**
 * Process text with OpenAI to generate an AnimationScript
 * @param text The text to process (question, concept, or description)
 * @returns AnimationScript ready for rendering
 */
export async function processCodeWithOpenAI(text) {
    console.log('🎬 Starting OpenAI processing for input:', text.substring(0, 100) + '...');
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    try {
        console.log('📤 Sending request to OpenAI GPT-4...');
        const response = await client.chat.completions.create({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: `Please explain this concept with an animation:\n\n${text}` }
            ],
            temperature: 0.7,
            max_tokens: 2000,
        });
        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('❌ No response from OpenAI');
        }
        console.log('📥 Received response from OpenAI');
        // Extract JSON from response (in case there's extra text)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('❌ No valid JSON found in OpenAI response');
        }
        const jsonString = jsonMatch[0];
        console.log('🔍 Parsing JSON response...');
        let animationScript;
        try {
            animationScript = JSON.parse(jsonString);
        }
        catch (parseError) {
            console.error('❌ JSON Parse Error:', parseError);
            throw new Error(`Invalid JSON from OpenAI: ${parseError}`);
        }
        console.log('✅ Validating AnimationScript structure...');
        animationScript = validateAnimationScript(animationScript);
        console.log('✅ Normalizing component types...');
        animationScript = normalizeComponentTypes(animationScript);
        console.log('✅ Validating timings...');
        animationScript = validateTimings(animationScript);
        console.log('✅ Successfully processed AnimationScript:', {
            totalDuration: `${animationScript.totalDuration}ms`,
            scenes: animationScript.scenes.length,
            voiceoverLength: animationScript.voiceover.text.length,
            voiceoverSegments: animationScript.voiceover.segments.length
        });
        return animationScript;
    }
    catch (error) {
        console.error('❌ Error processing code with OpenAI:', error);
        throw error;
    }
}
/**
 * Gets frame count for a given duration in milliseconds
 * @param durationMs Duration in milliseconds
 * @param fps Frames per second (default: 30)
 * @returns Number of frames
 */
export function msToFrames(durationMs, fps = 30) {
    return Math.floor((durationMs / 1000) * fps);
}
/**
 * Gets milliseconds for a given number of frames
 * @param frames Number of frames
 * @param fps Frames per second (default: 30)
 * @returns Duration in milliseconds
 */
export function framesToMs(frames, fps = 30) {
    return Math.floor((frames / fps) * 1000);
}
/**
 * Generates a Remotion-ready composition object from AnimationScript
 * This can be directly used to create dynamic compositions
 */
export function generateCompositionConfig(script) {
    return {
        id: `GeneratedAnimation_${Date.now()}`,
        durationInFrames: msToFrames(script.totalDuration),
        fps: 30,
        width: 1920,
        height: 1080,
        defaultProps: {
            script,
        },
    };
}
/**
 * Extracts all unique characters used in the script
 */
export function getUsedCharacters(script) {
    const characters = new Set();
    const validCharacters = ['AppCharacter', 'ChefCharacter', 'CustomerCharacter', 'WorkerCharacter'];
    for (const scene of script.scenes) {
        for (const element of scene.elements) {
            if (element.name && validCharacters.includes(element.name)) {
                characters.add(element.name);
            }
        }
    }
    return Array.from(characters);
}
/**
 * Extracts all unique buildings used in the script
 */
export function getUsedBuildings(script) {
    const buildings = new Set();
    const validBuildings = ['Restaurant', 'Bakery', 'Library', 'Factory'];
    for (const scene of script.scenes) {
        for (const element of scene.elements) {
            if (element.name && validBuildings.includes(element.name)) {
                buildings.add(element.name);
            }
        }
    }
    return Array.from(buildings);
}
/**
 * Summary of what components are used in the animation
 */
export function getAnimationSummary(script) {
    return {
        duration: `${script.totalDuration}ms (${Math.round(script.totalDuration / 1000)}s)`,
        scenes: script.scenes.length,
        characters: getUsedCharacters(script),
        buildings: getUsedBuildings(script),
        voiceoverLength: script.voiceover.text.length,
        segments: script.voiceover.segments.length,
    };
}
/**
 * Complete setup for Remotion v2 video generation
 * Processes code with OpenAI and returns all needed components for rendering
 *
 * @param script The code/concept to animate
 * @returns Object containing title, voiceoverText, and animationScript
 */
export async function setupRemotionV2(script) {
    console.log('🎬 Setting up Remotion v2 animation...');
    console.log('📝 Input script length:', script.length, 'characters');
    try {
        // Step 1: Process script with OpenAI to get AnimationScript
        console.log('🤖 Processing script with OpenAI GPT-4...');
        const animationScript = await processCodeWithOpenAI(script);
        console.log('✅ AnimationScript generated');
        // Step 2: Extract title from animation script
        const title = animationScript.title || 'Animation';
        console.log(`📌 Title extracted: "${title}"`);
        // Step 3: Extract voiceover text from animation script
        const voiceoverText = animationScript.voiceover.text;
        console.log(`📖 Voiceover text extracted: ${voiceoverText.length} characters`);
        console.log('✅ Remotion v2 setup completed successfully');
        console.log(`📊 Setup summary:
      - Title: "${title}"
      - Voiceover: ${voiceoverText.length} characters
      - Animation Duration: ${animationScript.totalDuration}ms
      - Scenes: ${animationScript.scenes.length}
    `);
        return {
            title,
            voiceoverText,
            animationScript
        };
    }
    catch (error) {
        console.error('❌ Error setting up Remotion v2:', error);
        throw error;
    }
}
//# sourceMappingURL=openaiProcessor.js.map