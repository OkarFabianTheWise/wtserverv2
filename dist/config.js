export class Config {
    openaiApiKey;
    useMock;
    voice;
    videoOutputDir;
    audioOutputDir;
    slidesOutputDir;
    constructor(options) {
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
//# sourceMappingURL=config.js.map