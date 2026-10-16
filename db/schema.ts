import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const matches = sqliteTable('matches', {
  code: text('code').primaryKey(),
  revision: integer('revision').notNull().default(0),
  payload: text('payload').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
