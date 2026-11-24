import { api } from './api';
import type { AiConversation, AiConversationDetail, AiConversationMode, AiMessage, ApiResponse } from '../types/api';

export async function chatWithPatient(
  patientProfileId: string,
  message: string
): Promise<string> {
  const response = await api.post<ApiResponse<{ reply: string }>>(
    '/ai/chat',
    {
      patientProfileId,
      message,
    },
    {
      timeout: 45000, // 45 seconds for AI responses
    }
  );

  return response.data.data.reply;
}

export async function listAiConversations(): Promise<AiConversation[]> {
  const response = await api.get<ApiResponse<AiConversation[]>>('/ai/conversations');
  return response.data.data;
}

export async function createAiConversation(mode: AiConversationMode, patientProfileId?: string): Promise<AiConversation> {
  const response = await api.post<ApiResponse<AiConversation>>('/ai/conversations', {
    mode,
    patientProfileId: patientProfileId ?? null,
  });
  return response.data.data;
}

export async function getAiConversation(id: string): Promise<AiConversationDetail> {
  const response = await api.get<ApiResponse<AiConversationDetail>>(`/ai/conversations/${encodeURIComponent(id)}`);
  return response.data.data;
}

export async function sendAiMessage(id: string, message: string): Promise<{ doctorMessage: AiMessage; assistantMessage: AiMessage }> {
  const response = await api.post<ApiResponse<{ doctorMessage: AiMessage; assistantMessage: AiMessage }>>(
    `/ai/conversations/${encodeURIComponent(id)}/messages`,
    { message },
    { timeout: 45000 },
  );
  return response.data.data;
}

export async function createAiLiveTicket(): Promise<{ ticket: string; expiresAt: string }> {
  const response = await api.post<ApiResponse<{ ticket: string; expiresAt: string }>>('/ai/live/tickets', {});
  return response.data.data;
}
