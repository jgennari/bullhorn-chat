import { randomUUID } from 'node:crypto'
import { sql, relations } from 'drizzle-orm'
import { sqliteTable, text, integer, index, unique } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text().primaryKey().$defaultFn(() => randomUUID()),
  email: text().notNull(),
  name: text().notNull(),
  avatar: text().notNull(),
  username: text().notNull(),
  provider: text({ enum: ['bullhorn'] }).notNull(),
  providerId: integer().notNull(),
  accessToken: text(),
  createdAt: integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
}, t => [
  unique().on(t.provider, t.providerId)
])

export const usersRelations = relations(users, ({ many }) => ({
  chats: many(chats)
}))

export const chats = sqliteTable('chats', {
  id: text().primaryKey().$defaultFn(() => randomUUID()),
  title: text(),
  userId: text().notNull(),
  lastResponseId: text(),
  createdAt: integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
}, t => [
  index('userIdIdx').on(t.userId)
])

export const chatsRelations = relations(chats, ({ one, many }) => ({
  user: one(users, {
    fields: [chats.userId],
    references: [users.id]
  }),
  messages: many(messages)
}))

export const messages = sqliteTable('messages', {
  id: text().primaryKey().$defaultFn(() => randomUUID()),
  chatId: text().notNull().references(() => chats.id, { onDelete: 'cascade' }),
  role: text({ enum: ['user', 'assistant'] }).notNull(),
  content: text().notNull(),
  responseId: text(),
  createdAt: integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
}, t => [
  index('chatIdIdx').on(t.chatId)
])

export const messagesRelations = relations(messages, ({ one, many }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id]
  }),
  feedback: many(feedback)
}))

export const feedback = sqliteTable('feedback', {
  id: text().primaryKey().$defaultFn(() => randomUUID()),
  messageId: text().notNull().references(() => messages.id, { onDelete: 'cascade' }),
  userId: text().notNull().references(() => users.id, { onDelete: 'cascade' }),
  rating: text({ enum: ['positive', 'negative'] }).notNull(),
  comment: text(),
  createdAt: integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
}, t => [
  index('messageIdIdx').on(t.messageId),
  index('userIdIdx').on(t.userId),
  unique().on(t.messageId, t.userId)
])

export const feedbackRelations = relations(feedback, ({ one }) => ({
  message: one(messages, {
    fields: [feedback.messageId],
    references: [messages.id]
  }),
  user: one(users, {
    fields: [feedback.userId],
    references: [users.id]
  })
}))
