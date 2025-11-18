"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = void 0;
class Config {
    constructor(options) {
        var _a, _b, _c, _d, _e;
        if (!options.openaiApiKey && !options.useMock) {
            throw new Error('OpenAI API key is required unless mock mode is enabled.');
        }
        this.openaiApiKey = options.openaiApiKey;
        this.useMock = (_a = options.useMock) !== null && _a !== void 0 ? _a : false;
        this.voice = (_b = options.voice) !== null && _b !== void 0 ? _b : 'en';
        this.videoOutputDir = (_c = options.videoOutputDir) !== null && _c !== void 0 ? _c : './output/videos';
        this.audioOutputDir = (_d = options.audioOutputDir) !== null && _d !== void 0 ? _d : './output/audio';
        this.slidesOutputDir = (_e = options.slidesOutputDir) !== null && _e !== void 0 ? _e : './output/slides';
    }
}
exports.Config = Config;
