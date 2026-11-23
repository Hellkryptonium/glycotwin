import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../../config/database.js';
import { aiConversations, aiMessages } from '../../db/schema/ai.js';
import { auditLogs } from '../../db/schema/audit-logs.js';

export type AiConversationMode = 'GENERAL' | 'PATIENT';
export type AiMessageRole = 'DOCTOR' | 'ASSISTANT';

export interface AiConversationRepository {
  create(input: { doctorUserId: string; patientProfileId: string | null; mode: AiConversationMode; title?: string }): Promise<typeof aiConversations.$inferSelect>;
  listForDoctor(doctorUserId: string): Promise<(typeof aiConversations.$inferSelect)[]>;
  findForDoctor(id: string, doctorUserId: string): Promise<typeof aiConversations.$inferSelect | null>;
  listMessages(conversationId: string, limit?: number): Promise<(typeof aiMessages.$inferSelect)[]>;
  appendMessage(input: { conversationId: string; actorUserId: string; role: AiMessageRole; content: string }): Promise<typeof aiMessages.$inferSelect>;
  updateTitle(id: string, doctorUserId: string, title: string): Promise<void>;
}

export function createAiConversationRepository(database: Database): AiConversationRepository {
  return {
    async create(input) {
      const [conversation] = await database.insert(aiConversations).values(input).returning();
      if (!conversation) throw new Error('AI conversation insert did not return a row.');
      return conversation;
    },
    listForDoctor(doctorUserId) {
      return database.select().from(aiConversations)
        .where(eq(aiConversations.doctorUserId, doctorUserId))
        .orderBy(desc(aiConversations.updatedAt)).limit(100);
    },
    async findForDoctor(id, doctorUserId) {
      const rows = await database.select().from(aiConversations)
        .where(and(eq(aiConversations.id, id), eq(aiConversations.doctorUserId, doctorUserId))).limit(1);
      return rows[0] ?? null;
    },
    listMessages(conversationId, limit = 40) {
      return database.select().from(aiMessages).where(eq(aiMessages.conversationId, conversationId))
        .orderBy(desc(aiMessages.createdAt)).limit(limit).then((rows) => rows.reverse());
    },
    async appendMessage(input) {
      return database.transaction(async (transaction) => {
        const [message] = await transaction.insert(aiMessages).values({
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
        }).returning();
        if (!message) throw new Error('AI message insert did not return a row.');
        await transaction.insert(auditLogs).values({
          actorUserId: input.actorUserId,
          action: input.role === 'DOCTOR' ? 'doctor.ai.message.sent' : 'doctor.ai.response.received',
          resourceType: 'ai_conversation',
          resourceId: input.conversationId,
        });
        await transaction.update(aiConversations).set({ updatedAt: new Date() })
          .where(eq(aiConversations.id, input.conversationId));
        return message;
      });
    },
    async updateTitle(id, doctorUserId, title) {
      await database.update(aiConversations).set({ title, updatedAt: new Date() })
        .where(and(eq(aiConversations.id, id), eq(aiConversations.doctorUserId, doctorUserId)));
    },
  };
}
