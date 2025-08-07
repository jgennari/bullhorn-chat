-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  messageId TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating TEXT NOT NULL CHECK (rating IN ('positive', 'negative')),
  comment TEXT,
  createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(messageId, userId)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS feedback_messageIdIdx ON feedback(messageId);
CREATE INDEX IF NOT EXISTS feedback_userIdIdx ON feedback(userId);