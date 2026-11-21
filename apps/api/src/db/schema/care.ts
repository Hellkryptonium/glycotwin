import { date, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { doctorPatientRelationships } from './relationships.js';

export const careItems = pgTable('care_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  relationshipId: uuid('relationship_id').notNull().references(() => doctorPatientRelationships.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 16 }).$type<'NOTE' | 'GOAL' | 'FOLLOW_UP'>().notNull(),
  title: varchar('title', { length: 160 }).notNull(),
  detail: text('detail'),
  dueDate: date('due_date'),
  status: varchar('status', { length: 8 }).$type<'OPEN' | 'DONE'>().notNull().default('OPEN'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [index('care_items_relationship_updated_idx').on(table.relationshipId, table.updatedAt)]);

export const visitBriefs = pgTable('visit_briefs', {
  id: uuid('id').defaultRandom().primaryKey(),
  relationshipId: uuid('relationship_id').notNull().references(() => doctorPatientRelationships.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 160 }).notNull(),
  notes: text('notes'),
  eventIds: uuid('event_ids').array().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [index('visit_briefs_relationship_created_idx').on(table.relationshipId, table.createdAt)]);
