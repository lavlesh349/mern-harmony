-- Enable the pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enum for content modality types
CREATE TYPE content_modality AS ENUM ('audio', 'document', 'web', 'text', 'image');

-- Enum for processing status
CREATE TYPE processing_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Knowledge items table - stores all ingested content
CREATE TABLE public.knowledge_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  modality content_modality NOT NULL,
  original_content TEXT, -- Original raw content or file path
  processed_content TEXT, -- Extracted/transcribed text
  metadata JSONB DEFAULT '{}', -- Source URL, file info, etc.
  embedding vector(1536), -- For semantic search
  source_timestamp TIMESTAMPTZ, -- When the original content was created
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status processing_status NOT NULL DEFAULT 'pending'
);

-- Create index for vector similarity search
CREATE INDEX knowledge_items_embedding_idx ON public.knowledge_items 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Full-text search index
CREATE INDEX knowledge_items_content_idx ON public.knowledge_items 
USING gin(to_tsvector('english', COALESCE(processed_content, '') || ' ' || COALESCE(title, '')));

-- Temporal index
CREATE INDEX knowledge_items_source_timestamp_idx ON public.knowledge_items (source_timestamp DESC);

-- Conversations table
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chat messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  context_ids UUID[] DEFAULT '{}', -- References to knowledge items used for context
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX messages_conversation_idx ON public.messages (conversation_id, created_at);

-- Storage bucket for uploaded files
INSERT INTO storage.buckets (id, name, public) VALUES ('knowledge-files', 'knowledge-files', true);

-- Storage policy for uploads
CREATE POLICY "Anyone can upload files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'knowledge-files');

CREATE POLICY "Anyone can view files"
ON storage.objects FOR SELECT
USING (bucket_id = 'knowledge-files');

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for timestamp updates
CREATE TRIGGER update_knowledge_items_updated_at
BEFORE UPDATE ON public.knowledge_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- RLS Policies (public access for demo - in production, add user_id column)
ALTER TABLE public.knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for knowledge items"
ON public.knowledge_items FOR SELECT USING (true);

CREATE POLICY "Public insert access for knowledge items"
ON public.knowledge_items FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update access for knowledge items"
ON public.knowledge_items FOR UPDATE USING (true);

CREATE POLICY "Public delete access for knowledge items"
ON public.knowledge_items FOR DELETE USING (true);

CREATE POLICY "Public read access for conversations"
ON public.conversations FOR SELECT USING (true);

CREATE POLICY "Public insert access for conversations"
ON public.conversations FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update access for conversations"
ON public.conversations FOR UPDATE USING (true);

CREATE POLICY "Public delete access for conversations"
ON public.conversations FOR DELETE USING (true);

CREATE POLICY "Public read access for messages"
ON public.messages FOR SELECT USING (true);

CREATE POLICY "Public insert access for messages"
ON public.messages FOR INSERT WITH CHECK (true);