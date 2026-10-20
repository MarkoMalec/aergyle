import "server-only";

import { countUnreadNotifications } from "./notifications";
import { countUnreadMessages, countWaitingConversations } from "./messages";
import { countFriendRequests } from "~/server/players/friends";

export {
  clearNotifications,
  countUnreadNotifications,
  listNotifications,
  markNotificationsRead,
  notify,
  notifyMany,
  type NotificationDraft,
  type NotificationView,
} from "./notifications";

export {
  countUnreadMessages,
  countWaitingConversations,
  deleteConversation,
  findPlayers,
  getConversation,
  listConversations,
  reportConversation,
  sendMessage,
  sendSystemMessage,
  type ConversationList,
  type ConversationMessage,
  type ConversationSummary,
  type ConversationThread,
  type PlayerRef,
} from "./messages";

export {
  countOpenReports,
  listReports,
  reviewReport,
  type ReportView,
  type TranscriptLine,
} from "./moderation";

export type CommunicationSummary = {
  notifications: number;
  messages: number;
  waiting: number;
  /** Friend requests waiting for an answer. */
  friendRequests: number;
};

/**
 * What the bell, the envelope and the Friends button in the sidebar show, in
 * one check.
 */
export async function getCommunicationSummary(
  userId: string,
): Promise<CommunicationSummary> {
  const [notifications, messages, waiting, friendRequests] = await Promise.all([
    countUnreadNotifications(userId),
    countUnreadMessages(userId),
    countWaitingConversations(userId),
    countFriendRequests(userId),
  ]);
  return { notifications, messages, waiting, friendRequests };
}
