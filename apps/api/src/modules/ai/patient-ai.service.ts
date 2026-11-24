import { and, desc, eq } from 'drizzle-orm';
import type { Content, GenerateContentParameters, GenerateContentResponse, Part } from '@google/genai';
import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import type { Database } from '../../config/database.js';
import { auditLogs } from '../../db/schema/audit-logs.js';
import { glucoseReadings } from '../../db/schema/glucose-readings.js';
import { medications } from '../../db/schema/medications.js';
import { patientAiConversations, patientAiMessages } from '../../db/schema/ai.js';
import { type AiDiagnosticContext, type AiGeminiClient } from './ai.service.js';
import { GeminiProviderError, GeminiTimeoutError } from './gemini.client.js';
import { createPatientsRepository } from '../patients/patients.repository.js';

const idSchema = z.string().uuid();
const messageSchema = z.string().trim().max(4_000);
const reviewKindSchema = z.enum(['FOOD', 'MEDICATION']);
const imageSchema = z.object({
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  base64: z.string().min(4).max(3_000_000).regex(/^[A-Za-z0-9+/]*={0,2}$/, 'Image data is invalid.'),
  name: z.string().trim().min(1).max(255).optional(),
});

export type PatientAiReviewKind = z.infer<typeof reviewKindSchema>;
export type PatientAiImage = z.infer<typeof imageSchema>;

export const patientAiMessageInputSchema = z.object({
  message: messageSchema,
  reviewKind: reviewKindSchema.optional(),
  image: imageSchema.optional(),
}).superRefine((value, context) => {
  if (!value.message && !value.image) context.addIssue({ code: 'custom', message: 'Write a message or attach an image.' });
  if (value.reviewKind && !value.image) context.addIssue({ code: 'custom', message: 'A review kind requires an image.' });
  if (value.image && !value.reviewKind) context.addIssue({ code: 'custom', message: 'Choose food or medication review for an image.' });
});

type PatientConversation = typeof patientAiConversations.$inferSelect;
type PatientMessage = typeof patientAiMessages.$inferSelect;

function titleFor(content: string, reviewKind?: PatientAiReviewKind) {
  const fallback = reviewKind === 'FOOD' ? 'Food photo review' : reviewKind === 'MEDICATION' ? 'Medication photo review' : 'New conversation';
  const normalized = content.replace(/\s+/g, ' ').trim() || fallback;
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

function providerReply(response: GenerateContentResponse) {
  const text = response.text?.trim() ?? response.candidates?.[0]?.content?.parts
    ?.map((part) => part.text).filter((part): part is string => typeof part === 'string').join('').trim();
  if (!text) throw new AppError(502, 'AI_EMPTY_RESPONSE', 'The AI provider returned no response.');
  return text;
}

function imageData(image: PatientAiImage) {
  const bytes = Buffer.from(image.base64, 'base64');
  if (!bytes.length || bytes.length > 2_250_000) throw new AppError(400, 'INVALID_AI_IMAGE', 'Use a JPEG, PNG, or WebP image smaller than 2 MB.');
  return bytes.toString('base64');
}

export function createPatientAiService(database: Database, geminiClient: AiGeminiClient | null, model: string) {
  const profiles = createPatientsRepository(database);
  const getProfile = async (patientUserId: string) => {
    const profile = await profiles.findByUserId(idSchema.parse(patientUserId));
    if (!profile) throw new AppError(404, 'PATIENT_PROFILE_NOT_FOUND', 'Patient profile was not found.');
    return profile;
  };
  const getConversation = async (patientProfileId: string, conversationId: string) => {
    const rows = await database.select().from(patientAiConversations).where(and(
      eq(patientAiConversations.id, idSchema.parse(conversationId)),
      eq(patientAiConversations.patientProfileId, patientProfileId),
    )).limit(1);
    if (!rows[0]) throw new AppError(404, 'AI_CONVERSATION_NOT_FOUND', 'AI conversation was not found.');
    return rows[0];
  };
  const listMessages = (conversationId: string, limit = 40) => database.select().from(patientAiMessages)
    .where(eq(patientAiMessages.conversationId, conversationId)).orderBy(desc(patientAiMessages.createdAt)).limit(limit).then((rows) => rows.reverse());

  return {
    async list(patientUserId: string) {
      const profile = await getProfile(patientUserId);
      return database.select().from(patientAiConversations).where(eq(patientAiConversations.patientProfileId, profile.id))
        .orderBy(desc(patientAiConversations.updatedAt)).limit(100);
    },
    async create(patientUserId: string) {
      const profile = await getProfile(patientUserId);
      const [conversation] = await database.insert(patientAiConversations).values({ patientProfileId: profile.id }).returning();
      if (!conversation) throw new Error('Patient AI conversation insert did not return a row.');
      return conversation;
    },
    async get(patientUserId: string, conversationId: string) {
      const profile = await getProfile(patientUserId);
      const conversation = await getConversation(profile.id, conversationId);
      return { conversation, messages: await listMessages(conversation.id) };
    },
    async send(patientUserId: string, conversationId: string, rawInput: unknown, diagnosticContext?: AiDiagnosticContext) {
      if (!geminiClient) throw new AppError(503, 'AI_DISABLED', 'The AI provider is unavailable.');
      const input = patientAiMessageInputSchema.parse(rawInput);
      const profile = await getProfile(patientUserId);
      const conversation = await getConversation(profile.id, conversationId);
      const history = await listMessages(conversation.id, 30);
      const content = input.message || (input.reviewKind === 'FOOD' ? 'Please review this food photo.' : 'Please review this medication photo.');
      const [patientMessage] = await database.transaction(async (transaction) => {
        const [saved] = await transaction.insert(patientAiMessages).values({
          conversationId: conversation.id, role: 'PATIENT', content, reviewKind: input.reviewKind ?? null, imageName: input.image?.name ?? null,
        }).returning();
        if (!saved) throw new Error('Patient AI message insert did not return a row.');
        await transaction.insert(auditLogs).values({ actorUserId: patientUserId, action: 'patient.ai.message.sent', resourceType: 'patient_ai_conversation', resourceId: conversation.id });
        await transaction.update(patientAiConversations).set({ updatedAt: new Date(), ...(history.length === 0 ? { title: titleFor(content, input.reviewKind) } : {}) })
          .where(eq(patientAiConversations.id, conversation.id));
        return [saved];
      });
      if (!patientMessage) throw new Error('Patient AI message insert did not return a row.');

      const [activeMedications, recentReadings] = await Promise.all([
        database.select({ name: medications.name, dosage: medications.dosage, frequency: medications.frequency }).from(medications)
          .where(and(eq(medications.patientId, profile.id), eq(medications.status, 'active'))).limit(20),
        database.select({ value: glucoseReadings.value, unit: glucoseReadings.unit, measuredAt: glucoseReadings.measuredAt, context: glucoseReadings.context }).from(glucoseReadings)
          .where(eq(glucoseReadings.patientId, profile.id)).orderBy(desc(glucoseReadings.measuredAt)).limit(10),
      ]);
      const healthContext = JSON.stringify({ diabetesType: profile.diabetesType, treatmentContext: profile.treatmentContext, activeMedications, recentGlucoseReadings: recentReadings });
      const systemInstruction = 'You are GlycoTwin AI, a patient-facing diabetes support assistant. Be supportive and concise. Use plain text with short paragraphs or bullet characters; do not use Markdown markers. You may summarize the server-authorized health context supplied below, but never diagnose, prescribe, change medication, or give dose instructions. For food photos: identify plausible items, give a clearly labelled rough carbohydrate estimate and ask the patient to correct portions. For medication photos: only extract what is visibly readable and compare it to the authorized medication list; never say a medicine is safe to take, a label is correct, or a dose should be changed. Tell the patient to contact a pharmacist or clinician for uncertainty, mismatches, symptoms, or medication decisions. Do not expose raw identifiers. Authorized context: ' + healthContext;
      const contents: Content[] = history.slice(-20).map((entry) => ({ role: entry.role === 'ASSISTANT' ? 'model' : 'user', parts: [{ text: entry.content }] }));
      const parts: Part[] = [{ text: content }];
      if (input.image) parts.push({ inlineData: { mimeType: input.image.mimeType, data: imageData(input.image) } });
      contents.push({ role: 'user', parts });
      let reply: string;
      try {
        reply = providerReply(await geminiClient.generateContent({ model, contents, config: { systemInstruction } } as GenerateContentParameters));
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (error instanceof GeminiTimeoutError) throw new AppError(504, 'AI_PROVIDER_TIMEOUT', 'The AI provider timed out.');
        if (error instanceof GeminiProviderError) diagnosticContext?.logger?.error({ requestId: diagnosticContext.requestId }, 'Gemini patient request failed');
        throw new AppError(502, 'AI_PROVIDER_ERROR', 'The AI provider is temporarily unavailable.');
      }
      const [assistantMessage] = await database.transaction(async (transaction) => {
        const [saved] = await transaction.insert(patientAiMessages).values({ conversationId: conversation.id, role: 'ASSISTANT', content: reply }).returning();
        if (!saved) throw new Error('Patient AI response insert did not return a row.');
        await transaction.insert(auditLogs).values({ actorUserId: patientUserId, action: 'patient.ai.response.received', resourceType: 'patient_ai_conversation', resourceId: conversation.id });
        await transaction.update(patientAiConversations).set({ updatedAt: new Date() }).where(eq(patientAiConversations.id, conversation.id));
        return [saved];
      });
      if (!assistantMessage) throw new Error('Patient AI response insert did not return a row.');
      return { patientMessage, assistantMessage };
    },
  };
}
