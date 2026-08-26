export interface Chat {
  chatId: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  messageCount: number;
}
