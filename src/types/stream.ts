export interface Stream {
  id: string;
  name: string;
  query: string;
  icon?: string;
  color?: string;
  unreadCount: number;
}

export interface CreateStreamInput {
  name: string;
  query: string;
}

export interface UpdateStreamInput {
  id: string;
  name: string;
  query: string;
  icon?: string;
  color?: string;
}
