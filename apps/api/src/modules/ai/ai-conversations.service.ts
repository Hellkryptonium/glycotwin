import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import type { AiService } from './ai.service.js';
import type { GetPatientProfileTool } from './patient-profile.tool.js';
import type { AiConversationRepository, AiConversationMode } from './ai-conversations.repository.js';

const idSchema = z.string().uuid();
const messageSchema = z.string().trim().min(1).max(4000);

function notFound() {
  return new AppError(404, 'AI_CONVERSATION_NOT_FOUND', 'AI conversation was not found.');
}

function conversationTitle(message: string) {
  const normalized = message.replace(/\s+/g, ' ').trim();
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

export function createAiConversationService(
  repository: AiConversationRepository,
  aiService: AiService,
  patientProfileTool: GetPatientProfileTool,
) {
  return {
    async list(doctorUserId: string) {
      return repository.listForDoctor(idSchema.parse(doctorUserId));
    },
    async create(doctorUserId: string, mode: AiConversationMode, patientProfileId?: string | null) {
      const trustedDoctorUserId = idSchema.parse(doctorUserId);
      if (mode === 'PATIENT') {
        if (!patientProfileId) throw new AppError(400, 'PATIENT_REQUIRED', 'Select a patient for a patient conversation.');
        await patientProfileTool.getPatientProfile(trustedDoctorUserId, idSchema.parse(patientProfileId));
      } else if (patientProfileId) {
        throw new AppError(400, 'INVALID_AI_CONVERSATION', 'General conversations cannot include patient context.');
      }
      return repository.create({ doctorUserId: trustedDoctorUserId, mode, patientProfileId: patientProfileId ?? null });
    },
    async get(doctorUserId: string, conversationId: string) {
      const conversation = await repository.findForDoctor(idSchema.parse(conversationId), idSchema.parse(doctorUserId));
      if (!conversation) throw notFound();
      return { conversation, messages: await repository.listMessages(conversation.id) };
    },
    async appendLiveMessage(
      doctorUserId: string,
      conversationId: string,
      role: 'DOCTOR' | 'ASSISTANT',
      content: string,
    ) {
      const trustedDoctorUserId = idSchema.parse(doctorUserId);
      const conversation = await repository.findForDoctor(idSchema.parse(conversationId), trustedDoctorUserId);
      if (!conversation) throw notFound();
      const normalized = messageSchema.parse(content);
      const history = await repository.listMessages(conversation.id, 1);
      const saved = await repository.appendMessage({ conversationId: conversation.id, actorUserId: trustedDoctorUserId, role, content: normalized });
      if (history.length === 0) await repository.updateTitle(conversation.id, trustedDoctorUserId, conversationTitle(normalized));
      return saved;
    },
    async send(doctorUserId: string, conversationId: string, message: string, diagnosticContext?: Parameters<AiService['reply']>[4]) {
      const trustedDoctorUserId = idSchema.parse(doctorUserId);
      const conversation = await repository.findForDoctor(idSchema.parse(conversationId), trustedDoctorUserId);
      if (!conversation) throw notFound();
      const content = messageSchema.parse(message);
      if (conversation.mode === 'PATIENT' && !conversation.patientProfileId) {
        throw new AppError(400, 'INVALID_AI_CONVERSATION', 'Patient context is unavailable for this conversation.');
      }
      if (conversation.patientProfileId) {
        await patientProfileTool.getPatientProfile(trustedDoctorUserId, conversation.patientProfileId);
      }
      const history = await repository.listMessages(conversation.id, 30);
      const doctorMessage = await repository.appendMessage({ conversationId: conversation.id, actorUserId: trustedDoctorUserId, role: 'DOCTOR', content });
      const reply = await aiService.reply(
        trustedDoctorUserId,
        conversation.patientProfileId,
        content,
        history.map((entry) => ({ role: entry.role, content: entry.content })),
        diagnosticContext,
      );
      const assistantMessage = await repository.appendMessage({ conversationId: conversation.id, actorUserId: trustedDoctorUserId, role: 'ASSISTANT', content: reply });
      if (history.length === 0) await repository.updateTitle(conversation.id, trustedDoctorUserId, conversationTitle(content));
      return { doctorMessage, assistantMessage };
    },
  };
}
