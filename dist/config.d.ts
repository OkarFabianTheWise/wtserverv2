export interface ConfigOptions {
    openaiApiKey: string;
    useMock?: boolean;
    voice?: string;
    videoOutputDir?: string;
    audioOutputDir?: string;
    slidesOutputDir?: string;
}
export declare class Config {
    openaiApiKey: string;
    useMock: boolean;
    voice: string;
    videoOutputDir: string;
    audioOutputDir: string;
    slidesOutputDir: string;
    constructor(options: ConfigOptions);
}
//# sourceMappingURL=config.d.ts.map