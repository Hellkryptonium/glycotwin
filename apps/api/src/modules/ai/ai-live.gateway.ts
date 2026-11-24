import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { GoogleGenAI, Modality } from '@google/genai';
import { WebSocket, WebSocketServer } from 'ws';
import { AppError } from '../../common/errors/app-error.js';
import type { Environment } from '../../config/env.js';
import type { PatientClinicalSummaryTool } from './patient-clinical-summary.tool.js';

type LiveConversationService = {
  get(doctorUserId: string, conversationId: string): Promise<{ conversation: { mode: 'GENERAL' | 'PATIENT'; patientProfileId: string | null }; messages: Array<{ role: 'DOCTOR' | 'ASSISTANT'; content: string }> }>;
  appendLiveMessage(doctorUserId: string, conversationId: string, role: 'DOCTOR' | 'ASSISTANT', content: string): Promise<{ id: string; conversationId: string; role: 'DOCTOR' | 'ASSISTANT'; content: string; createdAt: Date }>;
};

type Ticket = { doctorUserId: string; expiresAt: number };
type BrowserEvent =
  | { type: 'start'; conversationId: string }
  | { type: 'audio'; data: string }
  | { type: 'audio_end' }
  | { type: 'stop' };

function mergeTranscript(current: string, next: string) {
  if (!next) return current;
  if (next.startsWith(current)) return next;
  return `${current}${next}`;
}

/**
 * A small server-side relay for Gemini Live. The browser never receives the
 * Gemini API key; it only receives an opaque, one-time ticket for this relay.
 */
export class AiLiveGateway {
  private readonly tickets = new Map<string, Ticket>();

  constructor(
    private readonly environment: Environment,
    private readonly conversations: LiveConversationService,
    private readonly clinicalSummary: PatientClinicalSummaryTool,
  ) {}

  createTicket(doctorUserId: string) {
    if (!this.environment.AI_ENABLED || !this.environment.GEMINI_API_KEY) {
      throw new AppError(503, 'AI_LIVE_DISABLED', 'Live voice is unavailable because the AI provider is disabled.');
    }
    const ticket = randomUUID();
    const expiresAt = Date.now() + 60_000;
    this.tickets.set(ticket, { doctorUserId, expiresAt });
    return { ticket, expiresAt: new Date(expiresAt) };
  }

  attach(server: Server) {
    const websocketServer = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
    server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      if (url.pathname !== '/api/ai/live') return;
      if (this.environment.NODE_ENV === 'production' && request.headers.origin !== this.environment.FRONTEND_ORIGIN) {
        socket.destroy();
        return;
      }
      const id = url.searchParams.get('ticket');
      const ticket = id ? this.consumeTicket(id) : undefined;
      if (!ticket) { console.warn('Rejected Gemini Live WebSocket upgrade: missing or expired ticket.'); socket.destroy(); return; }
      websocketServer.handleUpgrade(request, socket, head, (client) => {
        websocketServer.emit('connection', client, request, ticket);
      });
    });
    websocketServer.on('connection', (client: WebSocket, _request: unknown, ticket: Ticket) => {
      console.info('Accepted Gemini Live WebSocket session.');
      this.open(client, ticket);
    });
  }

  private consumeTicket(id: string) {
    const ticket = this.tickets.get(id);
    this.tickets.delete(id);
    return ticket && ticket.expiresAt > Date.now() ? ticket : undefined;
  }

  private open(client: WebSocket, ticket: Ticket) {
    let session: { sendRealtimeInput(input: unknown): void; close(): void } | undefined;
    let started = false;
    const send = (event: Record<string, unknown>) => {
      if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(event));
    };
    const stop = () => { try { session?.close(); } catch { /* already closed */ } };

    client.on('close', stop);
    client.on('error', stop);
    client.on('message', async (raw, isBinary) => {
      const payload = Buffer.isBuffer(raw) ? raw : Array.isArray(raw) ? Buffer.concat(raw) : Buffer.from(raw);
      if (isBinary || payload.byteLength > 256 * 1024) { client.close(1008, 'Invalid Live message.'); return; }
      let event: BrowserEvent;
      try { event = JSON.parse(payload.toString()) as BrowserEvent; } catch { client.close(1008, 'Invalid Live message.'); return; }
      if (event.type === 'stop') { stop(); client.close(1000); return; }
      if (event.type === 'audio_end') {
        if (started && session) session.sendRealtimeInput({ audioStreamEnd: true });
        return;
      }
      if (event.type === 'audio') {
        if (!started || !session || typeof event.data !== 'string' || event.data.length > 220_000) return;
        // `audio`, rather than generic `media`, activates Gemini Live's
        // realtime audio/VAD pipeline for a continuous microphone stream.
        session.sendRealtimeInput({ audio: { mimeType: 'audio/pcm;rate=16000', data: event.data } });
        return;
      }
      if (event.type !== 'start' || started || typeof event.conversationId !== 'string') { client.close(1008, 'Invalid Live session setup.'); return; }
      try {
        const detail = await this.conversations.get(ticket.doctorUserId, event.conversationId);
        const systemInstruction = await this.systemInstruction(ticket.doctorUserId, detail.conversation, detail.messages);
        let inputTranscript = '';
        let outputTranscript = '';
        const saveTranscript = async (role: 'DOCTOR' | 'ASSISTANT', text: string) => {
          if (!text.trim()) return;
          try {
            const saved = await this.conversations.appendLiveMessage(ticket.doctorUserId, event.conversationId, role, text);
            send({ type: 'saved_message', message: saved });
          } catch { send({ type: 'error', message: 'Voice transcript could not be saved.' }); }
        };
        // Live is exposed through the Gemini Developer API beta WebSocket endpoint.
        const ai = new GoogleGenAI({ apiKey: this.environment.GEMINI_API_KEY!, apiVersion: 'v1beta' });
        session = await ai.live.connect({
          model: this.environment.GEMINI_LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO], systemInstruction,
            inputAudioTranscription: {}, outputAudioTranscription: {},
          },
          callbacks: {
            onopen: () => send({ type: 'ready' }),
            onmessage: (message: unknown) => {
              const transcription = this.forwardGeminiMessage(message, send);
              // Live can send either a delta or a complete replacement for a
              // transcript segment. Retain one clean copy in the clinical
              // conversation instead of duplicating words in either case.
              if (transcription.input) inputTranscript = mergeTranscript(inputTranscript, transcription.input);
              if (transcription.output) outputTranscript = mergeTranscript(outputTranscript, transcription.output);
              if (transcription.inputFinished) { void saveTranscript('DOCTOR', inputTranscript); inputTranscript = ''; }
              if (transcription.outputFinished) { void saveTranscript('ASSISTANT', outputTranscript); outputTranscript = ''; }
            },
            onerror: (error: unknown) => {
              console.error('Gemini Live provider error:', error instanceof Error ? error.message.slice(0, 500) : 'Unknown provider error');
              send({ type: 'error', message: 'The live voice session encountered an error.' });
            },
            onclose: () => send({ type: 'closed' }),
          },
        });
        started = true;
      } catch (error) {
        console.error('Unable to start Gemini Live session:', error instanceof Error ? error.message.slice(0, 500) : 'Unknown setup error');
        send({ type: 'error', message: 'Unable to start the live voice session.' });
        client.close(1011);
      }
    });
  }

  private async systemInstruction(doctorUserId: string, conversation: { mode: 'GENERAL' | 'PATIENT'; patientProfileId: string | null }, history: Array<{ role: 'DOCTOR' | 'ASSISTANT'; content: string }>) {
    const base = 'You are GlycoTwin Live, a clinician-facing voice assistant. Provide decision support, never diagnoses or treatment instructions. Keep answers concise and say when the clinical record needs review.';
    const recentHistory = history.slice(-12).map((message) => `${message.role === 'DOCTOR' ? 'Doctor' : 'Assistant'}: ${message.content}`).join('\n');
    if (conversation.mode !== 'PATIENT' || !conversation.patientProfileId) return `${base} This is a general conversation. Do not claim access to patient records. Recent conversation:\n${recentHistory}`;
    const summary = await this.clinicalSummary.getPatientClinicalSummary(doctorUserId, conversation.patientProfileId);
    return `${base} You are speaking only about this server-authorized patient context: ${JSON.stringify(summary)}. Never infer or invent data outside this context. Recent conversation:\n${recentHistory}`;
  }

  private forwardGeminiMessage(message: unknown, send: (event: Record<string, unknown>) => void) {
    const candidate = message as {
      serverContent?: {
        modelTurn?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string }; text?: string }> };
        interrupted?: boolean;
        inputTranscription?: { text?: string; finished?: boolean };
        interimInputTranscription?: { text?: string };
        outputTranscription?: { text?: string; finished?: boolean };
      };
    };
    const content = candidate.serverContent;
    if (content?.interrupted) send({ type: 'interrupted' });
    const input = content?.inputTranscription?.text ?? '';
    const interimInput = content?.interimInputTranscription?.text ?? '';
    const output = content?.outputTranscription?.text ?? '';
    if (input || interimInput) send({ type: 'transcript', role: 'DOCTOR', text: input || interimInput, finished: Boolean(content?.inputTranscription?.finished) });
    if (output) send({ type: 'transcript', role: 'ASSISTANT', text: output, finished: Boolean(content?.outputTranscription?.finished) });
    for (const part of content?.modelTurn?.parts ?? []) {
      if (part.inlineData?.data) send({ type: 'audio', data: part.inlineData.data, mimeType: part.inlineData.mimeType ?? 'audio/pcm;rate=24000' });
      if (part.text) send({ type: 'text', text: part.text });
    }
    return { input, output, inputFinished: Boolean(content?.inputTranscription?.finished), outputFinished: Boolean(content?.outputTranscription?.finished) };
  }
}
