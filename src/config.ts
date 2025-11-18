export interface ConfigOptions {
    openaiApiKey: string;
    useMock?: boolean;
    voice?: string;
    videoOutputDir?: string;
    audioOutputDir?: string;
    slidesOutputDir?: string;
}

export class Config {
    openaiApiKey: string;
    useMock: boolean;
    voice: string;
    videoOutputDir: string;
    audioOutputDir: string;
    slidesOutputDir: string;

    constructor(options: ConfigOptions) {
        if (!options.openaiApiKey && !options.useMock) {
            throw new Error('OpenAI API key is required unless mock mode is enabled.');
        }
    
        this.openaiApiKey = options.openaiApiKey;
        this.useMock = options.useMock ?? false;
        this.voice = options.voice ?? 'en';
        this.videoOutputDir = options.videoOutputDir ?? './output/videos';
        this.audioOutputDir = options.audioOutputDir ?? './output/audio';
        this.slidesOutputDir = options.slidesOutputDir ?? './output/slides';
        }
    }
    