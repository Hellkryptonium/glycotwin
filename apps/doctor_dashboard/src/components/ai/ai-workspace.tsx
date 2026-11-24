import { Bot, MessageSquarePlus, Mic, Send, Sparkles, Square, UserRound, UsersRound } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { createAiConversation, createAiLiveTicket, getAiConversation, listAiConversations, sendAiMessage } from '../../services/ai.api';
import { normalizeApiError } from '../../services/api';
import { useConnectedPatients } from '../../queries/patients.queries';
import type { AiConversation, AiConversationDetail, AiConversationMode, AiMessage, AiMessageRole } from '../../types/api';
import { Button } from '../ui/button';
import styles from './ai-workspace.module.css';

const prompts = [
  'Summarize the available patient context.',
  'What changed in the last 30 days?',
  'Help me prepare questions for the next visit.',
];

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer); let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function pcm16(input: Float32Array, sourceRate: number) {
  const ratio = sourceRate / 16_000;
  const output = new Int16Array(Math.floor(input.length / ratio));
  for (let index = 0; index < output.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[Math.floor(index * ratio)] ?? 0));
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output.buffer;
}

function liveSocketUrl(ticket: string) {
  // Next's HTTP rewrite is intentionally not used here: it does not proxy
  // WebSocket upgrades reliably in local development or all hosting targets.
  const configuredApi = process.env.NEXT_PUBLIC_LIVE_WS_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  if (configuredApi) {
    const api = new URL(configuredApi);
    const protocol = api.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${api.host}/api/ai/live?ticket=${encodeURIComponent(ticket)}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/backend/ai/live?ticket=${encodeURIComponent(ticket)}`;
}

function mergeTranscript(current: string, next: string) {
  if (!next) return current;
  if (next.startsWith(current)) return next;
  return `${current}${next}`;
}

export function AiWorkspace() {
  const router = useRouter();
  const initialPatientId = typeof router.query.patientId === 'string' ? router.query.patientId : '';
  // The connections endpoint intentionally caps page size at 50.
  const patients = useConnectedPatients(1, 50);
  const [mode, setMode] = useState<AiConversationMode>('GENERAL');
  const [patientId, setPatientId] = useState(initialPatientId);
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [detail, setDetail] = useState<AiConversationDetail | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [voice, setVoice] = useState<'idle' | 'connecting' | 'listening'>('idle');
  const [microphonePermission, setMicrophonePermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [liveTranscript, setLiveTranscript] = useState<Record<AiMessageRole, string>>({ DOCTOR: '', ASSISTANT: '' });
  const [error, setError] = useState<string | null>(null);
  const history = useRef<HTMLDivElement>(null);
  const liveSocket = useRef<WebSocket | null>(null);
  const liveStream = useRef<MediaStream | null>(null);
  const liveAudio = useRef<AudioContext | null>(null);
  const nextPlaybackTime = useRef(0);

  useEffect(() => {
    void (async () => {
      try {
        const list = await listAiConversations();
        setConversations(list);
      } catch (cause) { setError(normalizeApiError(cause).message); }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (initialPatientId) {
      setMode('PATIENT');
      setPatientId(initialPatientId);
    }
  }, [initialPatientId]);

  useEffect(() => {
    if (history.current) history.current.scrollTop = history.current.scrollHeight;
  }, [detail?.messages.length, sending, liveTranscript]);

  useEffect(() => () => { void stopVoice(); }, []);

  useEffect(() => {
    if (!navigator.permissions) return;
    void navigator.permissions.query({ name: 'microphone' as PermissionName }).then((permission) => {
      setMicrophonePermission(permission.state === 'granted' ? 'granted' : permission.state === 'denied' ? 'denied' : 'unknown');
      permission.onchange = () => setMicrophonePermission(permission.state === 'granted' ? 'granted' : permission.state === 'denied' ? 'denied' : 'unknown');
    }).catch(() => undefined);
  }, []);

  async function openConversation(conversation: AiConversation) {
    setError(null);
    try {
      const next = await getAiConversation(conversation.id);
      setDetail(next);
      setMode(next.conversation.mode);
      setPatientId(next.conversation.patientProfileId ?? '');
    } catch (cause) { setError(normalizeApiError(cause).message); }
  }

  async function startConversation(): Promise<AiConversation | null> {
    if (mode === 'PATIENT' && !patientId) {
      setError('Select a connected patient before starting a patient conversation.');
      return null;
    }
    setError(null);
    try {
      const conversation = await createAiConversation(mode, mode === 'PATIENT' ? patientId : undefined);
      setConversations((current) => [conversation, ...current]);
      setDetail({ conversation, messages: [] });
      return conversation;
    } catch (cause) {
      setError(normalizeApiError(cause).message);
      return null;
    }
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const content = message.trim();
    if (!content || sending) return;
    const activeConversation = detail?.conversation ?? await startConversation();
    if (!activeConversation) return;
    setError(null);
    setSending(true);
    setMessage('');
    const optimistic = { id: `pending-${Date.now()}`, conversationId: activeConversation.id, role: 'DOCTOR' as const, content, createdAt: new Date().toISOString() };
    setDetail((current) => current ? { ...current, messages: [...current.messages, optimistic] } : current);
    try {
      const result = await sendAiMessage(activeConversation.id, content);
      setDetail((current) => current ? { ...current, messages: [...current.messages.filter((entry) => entry.id !== optimistic.id), result.doctorMessage, result.assistantMessage] } : current);
      setConversations((current) => current.map((entry) => entry.id === activeConversation.id ? { ...entry, title: entry.title === 'New conversation' ? content.slice(0, 80) : entry.title, updatedAt: result.assistantMessage.createdAt } : entry)
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
    } catch (cause) {
      setDetail((current) => current ? { ...current, messages: current.messages.filter((entry) => entry.id !== optimistic.id) } : current);
      setMessage(content);
      setError(normalizeApiError(cause).message);
    } finally { setSending(false); }
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit(); }
  }

  function playVoiceAudio(data: string) {
    const context = liveAudio.current; if (!context) return;
    const binary = atob(data); const samples = new Int16Array(binary.length / 2);
    for (let index = 0; index < samples.length; index += 1) samples[index] = binary.charCodeAt(index * 2) | (binary.charCodeAt(index * 2 + 1) << 8);
    const audio = context.createBuffer(1, samples.length, 24_000);
    const channel = audio.getChannelData(0);
    samples.forEach((sample, index) => { channel[index] = sample / 0x8000; });
    const source = context.createBufferSource(); source.buffer = audio; source.connect(context.destination);
    const now = context.currentTime; nextPlaybackTime.current = Math.max(nextPlaybackTime.current, now); source.start(nextPlaybackTime.current); nextPlaybackTime.current += audio.duration;
  }

  async function requestMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser does not support microphone access for live voice.');
      return false;
    }
    try {
      liveStream.current?.getTracks().forEach((track) => track.stop());
      liveStream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      setMicrophonePermission('granted');
      return true;
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : '';
      setMicrophonePermission('denied');
      setError(name === 'NotAllowedError'
        ? 'Microphone permission was denied. Use the browser address-bar site controls to allow it, then choose Enable microphone again.'
        : 'We could not access a microphone. Check that a microphone is connected and available.');
      return false;
    }
  }

  async function beginMicrophone(socket: WebSocket) {
    const stream = liveStream.current;
    if (!stream) throw new Error('Microphone permission is required.');
    const context = liveAudio.current ?? new AudioContext(); liveAudio.current = context;
    await context.resume();
    const source = context.createMediaStreamSource(stream); const processor = context.createScriptProcessor(2048, 1, 1);
    processor.onaudioprocess = (event) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ type: 'audio', data: toBase64(pcm16(event.inputBuffer.getChannelData(0), context.sampleRate)) }));
    };
    // Keep the processor active without routing the mic back to the speakers.
    const silentGain = context.createGain(); silentGain.gain.value = 0;
    source.connect(processor); processor.connect(silentGain); silentGain.connect(context.destination);
    (liveStream.current as MediaStream & { processor?: ScriptProcessorNode; source?: MediaStreamAudioSourceNode }).processor = processor;
    (liveStream.current as MediaStream & { processor?: ScriptProcessorNode; source?: MediaStreamAudioSourceNode; silentGain?: GainNode }).source = source;
    (liveStream.current as MediaStream & { processor?: ScriptProcessorNode; source?: MediaStreamAudioSourceNode; silentGain?: GainNode }).silentGain = silentGain;
  }

  async function stopVoice() {
    const stream = liveStream.current as (MediaStream & { processor?: ScriptProcessorNode; source?: MediaStreamAudioSourceNode; silentGain?: GainNode }) | null;
    stream?.processor?.disconnect(); stream?.source?.disconnect(); stream?.silentGain?.disconnect(); stream?.getTracks().forEach((track) => track.stop());
    liveStream.current = null;
    const socket = liveSocket.current;
    liveSocket.current = null;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'audio_end' }));
      socket.send(JSON.stringify({ type: 'stop' }));
    }
    socket?.close();
    setLiveTranscript({ DOCTOR: '', ASSISTANT: '' });
    setVoice('idle');
  }

  async function toggleVoice() {
    if (voice !== 'idle') { await stopVoice(); return; }
    const activeConversation = detail?.conversation ?? await startConversation();
    if (!activeConversation) return;
    setError(null);
    if (!await requestMicrophone()) return;
    setVoice('connecting');
    try {
      const ticket = await createAiLiveTicket();
      const socket = new WebSocket(liveSocketUrl(ticket.ticket));
      let receivedReady = false;
      liveSocket.current = socket;
      socket.onopen = () => socket.send(JSON.stringify({ type: 'start', conversationId: activeConversation.id }));
      socket.onmessage = (event) => {
        const incoming = JSON.parse(String(event.data)) as { type: string; data?: string; message?: unknown; role?: AiMessageRole; text?: string; finished?: boolean };
        if (incoming.type === 'ready') { receivedReady = true; void beginMicrophone(socket).then(() => setVoice('listening')).catch((cause) => { setError(normalizeApiError(cause).message); void stopVoice(); }); }
        if (incoming.type === 'audio' && incoming.data) playVoiceAudio(incoming.data);
        if (incoming.type === 'transcript' && incoming.role && incoming.text) {
          setLiveTranscript((current) => ({ ...current, [incoming.role!]: incoming.finished ? '' : mergeTranscript(current[incoming.role!], incoming.text!) }));
        }
        if (incoming.type === 'saved_message' && incoming.message) {
          const saved = incoming.message as AiMessage;
          setDetail((current) => current && current.conversation.id === saved.conversationId && !current.messages.some((entry) => entry.id === saved.id)
            ? { ...current, messages: [...current.messages, saved] } : current);
          setLiveTranscript((current) => ({ ...current, [saved.role]: '' }));
          setConversations((current) => current.map((conversation) => conversation.id === saved.conversationId
            ? { ...conversation, title: conversation.title === 'New conversation' ? saved.content.slice(0, 80) : conversation.title, updatedAt: saved.createdAt }
            : conversation).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
        }
        if (incoming.type === 'error') { setError(typeof incoming.message === 'string' ? incoming.message : 'Live voice is unavailable.'); void stopVoice(); }
      };
      socket.onerror = () => { setError('The browser could not connect to the Live voice service. Restart the dashboard after updating its environment configuration.'); void stopVoice(); };
      socket.onclose = (event) => {
        if (liveSocket.current === socket) liveSocket.current = null;
        const stream = liveStream.current as (MediaStream & { processor?: ScriptProcessorNode; source?: MediaStreamAudioSourceNode; silentGain?: GainNode }) | null;
        stream?.processor?.disconnect(); stream?.source?.disconnect(); stream?.silentGain?.disconnect(); stream?.getTracks().forEach((track) => track.stop());
        liveStream.current = null;
        if (!receivedReady && event.code !== 1000) setError(`Live voice connection closed before it was ready (${event.code}).`);
        setVoice('idle');
      };
    } catch (cause) { setError(normalizeApiError(cause).message); setVoice('idle'); }
  }

  const selectedPatient = patients.data?.items.find((patient) => patient.patientId === patientId);
  const patientMode = mode === 'PATIENT';
  const liveDrafts: AiMessage[] = (['DOCTOR', 'ASSISTANT'] as const).flatMap((role) => liveTranscript[role].trim() ? [{
    id: `live-${role}`, conversationId: detail?.conversation.id ?? '', role, content: liveTranscript[role], createdAt: new Date().toISOString(),
  }] : []);
  return <section className={styles.workspace} aria-label="GlycoTwin AI workspace">
    <aside className={styles.sidebar}>
      <div className={styles.sideHead}><div><span>GlycoTwin</span><strong>AI workspace</strong></div><button type="button" onClick={() => void startConversation()} aria-label="New conversation"><MessageSquarePlus size={18} /></button></div>
      <div className={styles.modePicker} aria-label="Conversation type">
        <button type="button" className={!patientMode ? styles.selectedMode : ''} onClick={() => { setMode('GENERAL'); setPatientId(''); setDetail(null); }}><Sparkles size={15} />General</button>
        <button type="button" className={patientMode ? styles.selectedMode : ''} onClick={() => { setMode('PATIENT'); setDetail(null); }}><UsersRound size={15} />Patient</button>
      </div>
      <div className={styles.conversationList}>
        <span className={styles.listLabel}>Recent conversations</span>
        {loading ? <p>Loading conversations…</p> : conversations.length ? conversations.map((conversation) => <button type="button" key={conversation.id} className={detail?.conversation.id === conversation.id ? styles.activeConversation : ''} onClick={() => void openConversation(conversation)}>
          <strong>{conversation.title}</strong><small>{conversation.mode === 'PATIENT' ? 'Patient context' : 'General'}</small>
        </button>) : <p>No conversations yet.</p>}
      </div>
    </aside>
    <div className={styles.chatPane}>
      <header className={styles.chatHead}>
        <div><span className={styles.eyebrow}>{patientMode ? 'Patient assistant' : 'General assistant'}</span><h2>{patientMode ? (selectedPatient?.fullName ?? 'Select a patient') : 'How can I help?'}</h2></div>
        {patientMode && <label className={styles.patientPicker}>Patient<select value={patientId} onChange={(event) => { setPatientId(event.target.value); setDetail(null); }}><option value="">Choose a connected patient</option>{patients.data?.items.map((patient) => <option key={patient.patientId} value={patient.patientId}>{patient.fullName ?? 'Profile in progress'}</option>)}</select></label>}
      </header>
      {patientMode && <div className={styles.context}><span>Patient context is locked to the selected active care relationship.</span>{selectedPatient && <strong>{selectedPatient.fullName ?? 'Profile in progress'}</strong>}</div>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.history} ref={history} aria-live="polite">
        {!detail?.messages.length && !liveDrafts.length ? <div className={styles.empty}><Bot size={28} /><div><h3>{detail ? 'Start the conversation' : 'Open a new conversation'}</h3><p>{patientMode ? 'Ask about recorded trends, medications, lifestyle activity, or visit preparation.' : 'Use general mode for non-patient workflow questions. Patient records are never available here.'}</p>{patientMode && <div className={styles.prompts}>{prompts.map((prompt) => <button type="button" key={prompt} onClick={() => setMessage(prompt)}>{prompt}</button>)}</div>}</div></div> : [...(detail?.messages ?? []), ...liveDrafts].map((entry) => <article key={entry.id} className={`${styles.message} ${entry.role === 'DOCTOR' ? styles.doctor : styles.assistant} ${entry.id.startsWith('live-') ? styles.liveMessage : ''}`}><span className={styles.avatar}>{entry.role === 'DOCTOR' ? <UserRound size={16} /> : <Bot size={16} />}</span><div><strong>{entry.role === 'DOCTOR' ? 'You' : 'GlycoTwin AI'}{entry.id.startsWith('live-') ? ' · speaking…' : ''}</strong>{entry.role === 'DOCTOR' ? <p>{entry.content}</p> : <div className={styles.markdown}><ReactMarkdown>{entry.content}</ReactMarkdown></div>}</div></article>)}
        {sending && <div className={styles.thinking}><i /><i /><i />GlycoTwin AI is responding…</div>}
      </div>
      <form className={styles.composer} onSubmit={(event) => void submit(event)}><textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={keyDown} maxLength={4000} rows={2} disabled={sending || (patientMode && !patientId)} placeholder={patientMode && !patientId ? 'Select a patient to begin' : 'Message GlycoTwin AI…'} /><button className={`${styles.voiceButton} ${voice !== 'idle' ? styles.voiceActive : ''}`} type="button" onClick={() => void toggleVoice()} disabled={patientMode && !patientId} aria-label={voice === 'idle' ? 'Start live voice' : 'Stop live voice'}>{voice === 'idle' ? <Mic size={17} /> : <Square size={15} />}</button><Button type="submit" disabled={sending || !message.trim() || (patientMode && !patientId)} icon={<Send size={16} />}>Send</Button></form>
      {microphonePermission !== 'granted' && <button className={styles.permissionButton} type="button" onClick={() => void requestMicrophone()}><Mic size={14} />{microphonePermission === 'denied' ? 'Enable microphone in browser' : 'Enable microphone'}</button>}
      <p className={styles.disclaimer}>AI responses are decision support, not diagnoses or treatment instructions. Verify against the clinical record.</p>
    </div>
  </section>;
}
