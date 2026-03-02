export type PostType = 'text' | 'photo' | 'video';
export type PostStatus = 'success' | 'error';

export interface PostHistory {
  id: number;
  created_at: string;
  topic: string;
  post_type: PostType;
  status: PostStatus;
  title_preview: string;
  text_preview: string;
  error_message: string | null;
}

export interface QueueItem {
  topic: string;
  video_url: string;
}
