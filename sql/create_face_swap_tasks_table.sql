-- Create face_swap_tasks table for PiAPI face swap operations
-- Supports both image face swap and video face swap
-- This replaces the complex akool_tasks table with a simpler structure

-- Drop table if exists (for clean recreation)
DROP TABLE IF EXISTS face_swap_tasks CASCADE;

-- Create the face_swap_tasks table
CREATE TABLE face_swap_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL, -- Can be UUID or string ID
  user_image_url TEXT NOT NULL,
  product_image_url TEXT NOT NULL,
  pi_task_id TEXT, -- Stores the task_id from PiAPI response
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  task_type TEXT NOT NULL DEFAULT 'face_swap' CHECK (task_type IN ('face_swap', 'video_face_swap')),
  result_images TEXT[], -- Array of result image URLs
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_face_swap_tasks_user_id ON face_swap_tasks(user_id);
CREATE INDEX idx_face_swap_tasks_status ON face_swap_tasks(status);
CREATE INDEX idx_face_swap_tasks_pi_task_id ON face_swap_tasks(pi_task_id);
CREATE INDEX idx_face_swap_tasks_created_at ON face_swap_tasks(created_at);

-- Add trigger to update updated_at automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_face_swap_tasks_updated_at 
    BEFORE UPDATE ON face_swap_tasks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE face_swap_tasks IS 'Face swap tasks using PiAPI service - supports both image and video face swaps';
COMMENT ON COLUMN face_swap_tasks.pi_task_id IS 'Task ID returned by PiAPI for status polling';
COMMENT ON COLUMN face_swap_tasks.status IS 'Current status: pending, processing, completed, failed';
COMMENT ON COLUMN face_swap_tasks.task_type IS 'Type of face swap: face_swap (images) or video_face_swap (videos)';
COMMENT ON COLUMN face_swap_tasks.result_images IS 'Array of result URLs when completed (images for face_swap, video URL for video_face_swap)';

-- Create policy for Row Level Security (if using RLS)
-- ALTER TABLE face_swap_tasks ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view their own face swap tasks" ON face_swap_tasks 
--   FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY "Users can insert their own face swap tasks" ON face_swap_tasks 
--   FOR INSERT WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY "Users can update their own face swap tasks" ON face_swap_tasks 
--   FOR UPDATE USING (auth.uid() = user_id); 