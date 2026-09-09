export type Role = 'werewolf' | 'seer' | 'villager';
export type Phase = 'night' | 'discussion' | 'voting' | 'ended';

export interface Player {
  id: string;
  name: string;
  role: Role;
  isAI: boolean;
  isAlive: boolean;
}

export interface Message {
  sender: string;
  content: string;
  timestamp: number;
}
