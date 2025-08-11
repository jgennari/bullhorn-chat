-- Add responseId column to messages table for tracking OpenAI response IDs
ALTER TABLE messages ADD COLUMN responseId TEXT;

-- Create index for better query performance when looking up messages by response ID
CREATE INDEX IF NOT EXISTS messages_responseIdIdx ON messages(responseId);