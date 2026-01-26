import WebSocket from 'ws';
import { IncomingMessage } from 'http';
declare class WebSocketManager {
    private clients;
    private jobSubscribers;
    handleConnection(ws: WebSocket, request: IncomingMessage): void;
    private handleMessage;
    private subscribeToJob;
    private unsubscribeFromJob;
    private cleanupClient;
    emitProgress(jobId: string, progress: number, status: string, message?: string, data?: any): void;
    emitCompleted(jobId: string, videoId?: string, duration?: number): void;
    emitError(jobId: string, error: string): void;
}
export declare const wsManager: WebSocketManager;
export declare const webSocketManager: WebSocketManager;
export {};
//# sourceMappingURL=websocket.d.ts.map