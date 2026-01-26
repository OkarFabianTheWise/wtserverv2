import WebSocket from 'ws';
import { IncomingMessage } from 'http';

const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true';

interface WSClient {
    ws: WebSocket;
    subscribedJobs: Set<string>;
}

class WebSocketManager {
    private clients: Map<WebSocket, WSClient> = new Map();
    private jobSubscribers: Map<string, Set<WebSocket>> = new Map();

    handleConnection(ws: WebSocket, request: IncomingMessage) {
        if (VERBOSE_LOGGING) console.log('New WebSocket connection established');

        const client: WSClient = {
            ws,
            subscribedJobs: new Set()
        };

        this.clients.set(ws, client);

        ws.on('message', (data: Buffer) => {
            try {
                const message = JSON.parse(data.toString());
                this.handleMessage(client, message);
            } catch (err) {
                if (VERBOSE_LOGGING) console.error('Invalid WebSocket message:', err);
                ws.send(JSON.stringify({ error: 'Invalid message format' }));
            }
        });

        ws.on('close', () => {
            if (VERBOSE_LOGGING) console.log('WebSocket connection closed');
            this.cleanupClient(client);
        });

        ws.on('error', (err) => {
            if (VERBOSE_LOGGING) console.error('WebSocket error:', err);
        });

        // Send welcome message
        ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected successfully' }));
    }

    private handleMessage(client: WSClient, message: any) {
        const { action, jobId } = message;

        if (action === 'subscribe' && jobId) {
            this.subscribeToJob(client, jobId);
        } else if (action === 'unsubscribe' && jobId) {
            this.unsubscribeFromJob(client, jobId);
        } else {
            client.ws.send(JSON.stringify({ error: 'Unknown action or missing jobId' }));
        }
    }

    private subscribeToJob(client: WSClient, jobId: string) {
        client.subscribedJobs.add(jobId);

        if (!this.jobSubscribers.has(jobId)) {
            this.jobSubscribers.set(jobId, new Set());
        }
        this.jobSubscribers.get(jobId)!.add(client.ws);

        if (VERBOSE_LOGGING) console.log(`Client subscribed to job ${jobId}`);
        client.ws.send(JSON.stringify({ type: 'subscribed', jobId }));
    }

    private unsubscribeFromJob(client: WSClient, jobId: string) {
        client.subscribedJobs.delete(jobId);

        const subscribers = this.jobSubscribers.get(jobId);
        if (subscribers) {
            subscribers.delete(client.ws);
            if (subscribers.size === 0) {
                this.jobSubscribers.delete(jobId);
            }
        }

        if (VERBOSE_LOGGING) console.log(`Client unsubscribed from job ${jobId}`);
        client.ws.send(JSON.stringify({ type: 'unsubscribed', jobId }));
    }

    private cleanupClient(client: WSClient) {
        for (const jobId of client.subscribedJobs) {
            this.unsubscribeFromJob(client, jobId);
        }
        this.clients.delete(client.ws);
    }

    // Method to emit progress updates to subscribers
    emitProgress(jobId: string, progress: number, status: string, message?: string, data?: any) {
        const subscribers = this.jobSubscribers.get(jobId);
        if (!subscribers) return;

        const update = {
            type: 'progress',
            jobId,
            progress,
            status,
            message,
            data,
            timestamp: new Date().toISOString()
        };

        const messageStr = JSON.stringify(update);
        subscribers.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(messageStr);
            }
        });

        // if (VERBOSE_LOGGING) console.log(`Emitted progress for job ${jobId}: ${progress}% - ${status}`);
    }

    // Method to emit completion
    emitCompleted(jobId: string, videoId?: string, duration?: number) {
        const subscribers = this.jobSubscribers.get(jobId);
        if (!subscribers) return;

        const update = {
            type: 'completed',
            jobId,
            videoId,
            duration,
            timestamp: new Date().toISOString()
        };

        const messageStr = JSON.stringify(update);
        subscribers.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(messageStr);
            }
        });

        if (VERBOSE_LOGGING) console.log(`Emitted completion for job ${jobId}`);
    }

    // Method to emit error
    emitError(jobId: string, error: string) {
        const subscribers = this.jobSubscribers.get(jobId);
        if (!subscribers) return;

        const update = {
            type: 'error',
            jobId,
            error,
            timestamp: new Date().toISOString()
        };

        const messageStr = JSON.stringify(update);
        subscribers.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(messageStr);
            }
        });

        if (VERBOSE_LOGGING) console.log(`Emitted error for job ${jobId}: ${error}`);
    }
}

export const wsManager = new WebSocketManager();
export const webSocketManager = wsManager;  // Alias for consistency