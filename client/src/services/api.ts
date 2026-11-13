import axios from "axios";

export const TOKEN_STORAGE_KEY = "resolveai_auth_token";
export const USER_STORAGE_KEY = "resolveai_auth_user";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000/api"
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401 responses (stale/invalid token)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !error.config?.url?.includes("/auth/login") &&
      !error.config?.url?.includes("/auth/register") &&
      !error.config?.url?.includes("/auth/me")
    ) {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
      const isMockToken = token.startsWith("mock-") || token.startsWith("switched-") || token.startsWith("google-session-");
      if (!isMockToken) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);


export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "USER" | "STAFF" | "TECHNICIAN" | "ADMIN";
  googleId?: string;
  profileImage?: string;
  status?: string;
  department?: string;
  phone?: string;
  active: boolean;
  lastLogin?: string;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
}

export interface RagChunk {
  chunkId: string;
  documentId: string;
  title: string;
  content: string;
  relevance: number;
  metadata: Record<string, unknown>;
}

export interface KnowledgeDocumentSummary {
  documentId: string;
  title: string;
  category: string;
  chunkCount: number;
  storage: "memory" | "mongodb-vector";
  updatedAt: string;
}

export interface AssignmentTechnicianInput {
  id: string;
  skills: string[];
  availability: "AVAILABLE" | "BUSY" | "OFFLINE";
  workload: number;
  capacity: number;
  averageResolutionHours: number;
}

export interface AssignmentDecision {
  technicianId: string | null;
  score: number;
  reason: string;
  alternatives: Array<{ technicianId: string; score: number }>;
  explanation: {
    skillMatch: number;
    availability: number;
    workload: number;
    speed: number;
    priorityFit: number;
  };
}

export type ChatMessageRole = "system" | "user" | "assistant";

export interface ChatMessageRecord {
  id: string;
  conversationId: string;
  role: ChatMessageRole;
  content: string;
  createdAt: string;
}

export interface ChatConversationRecord {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessageRecord[];
  state?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export async function requestNextAction(problemDescription: string) {
  const response = await api.post("/troubleshooting/next-action", {
    problemDescription,
    category: problemDescription.toLowerCase().includes("wi-fi") ? "wi-fi" : "general",
    context: { source: "frontend-demo" },
    failedActions: [],
    aiConfidence: 0.78,
    severity: problemDescription.toLowerCase().includes("production") ? "CRITICAL" : "LOW"
  });

  return response.data;
}

export async function requestTechnicianAssignment(input: {
  category: string;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  priority?: "P4" | "P3" | "P2" | "P1";
  requiredSkills?: string[];
  preferredTechnicianIds?: string[];
  technicians: AssignmentTechnicianInput[];
}) {
  const response = await api.post<{ decision: AssignmentDecision }>("/assignment/select-technician", input);
  return response.data.decision;
}

export async function listKnowledgeDocuments() {
  const response = await api.get<{ documents: KnowledgeDocumentSummary[] }>("/knowledge/documents");
  return response.data.documents;
}

export async function indexKnowledgeDocument(input: { title: string; category: string; content: string }) {
  const response = await api.post<{ document: KnowledgeDocumentSummary }>("/knowledge/documents", input);
  return response.data.document;
}

export async function searchKnowledge(query: string, category?: string) {
  const response = await api.post<{ chunks: RagChunk[] }>("/knowledge/search", {
    query,
    category: category || undefined,
    limit: 5
  });

  return response.data.chunks;
}

export async function listChatConversations(userId?: string) {
  const response = await api.get<{ conversations: ChatConversationRecord[] }>("/chat", {
    params: userId ? { userId } : undefined
  });
  return response.data.conversations;
}

export async function createChatConversation(input: { userId?: string; message?: string } = {}) {
  const response = await api.post<{ conversation: ChatConversationRecord }>("/chat/new", input);
  return response.data.conversation;
}

export async function getChatConversation(conversationId: string, userId?: string) {
  const response = await api.get<{ conversation: ChatConversationRecord }>(`/chat/${conversationId}`, {
    params: userId ? { userId } : undefined
  });
  return response.data.conversation;
}

export async function sendChatMessage(conversationId: string, message: string, userId?: string) {
  const response = await api.post<{ conversation: ChatConversationRecord }>(`/chat/${conversationId}/message`, {
    message,
    ...(userId ? { userId } : {})
  });
  return response.data.conversation;
}

export async function deleteChatConversation(conversationId: string, userId?: string) {
  const response = await api.delete<{ success: boolean }>(`/chat/${conversationId}`, {
    params: userId ? { userId } : undefined
  });
  return response.data;
}

export type LoginApiResponse =
  | AuthSession
  | {
      requirePasskey: true;
      email: string;
      name: string;
      role: "ADMIN";
    };

export async function loginApi(credentials: { email: string; password: string; passkey?: string }): Promise<LoginApiResponse> {
  const response = await api.post<LoginApiResponse>("/auth/login", credentials);
  return response.data;
}

export async function loginWithGoogleApi(data: {
  credential?: string;
  googleId?: string;
  email?: string;
  name?: string;
  profileImage?: string;
  role?: string;
  department?: string;
  passkey?: string;
}): Promise<AuthSession> {
  const response = await api.post<AuthSession>("/auth/google", data);
  return response.data;
}

export async function contributeStaffKnowledgeApi(data: {
  ticketId?: string;
  title: string;
  problem: string;
  rootCause?: string;
  troubleshootingSteps: string[] | string;
  solution: string;
  category: string;
  tags?: string[] | string;
  department?: string;
}) {
  const response = await api.post("/staff/knowledge", data);
  return response.data;
}

export async function registerApi(data: {
  name: string;
  email: string;
  password: string;
  role?: "USER" | "STAFF" | "TECHNICIAN" | "ADMIN";
  department?: string;
  phone?: string;
}) {
  const response = await api.post<AuthSession>("/auth/register", data);
  return response.data;
}

export async function getMeApi() {
  const response = await api.get<{ user: AuthUser }>("/auth/me");
  return response.data.user;
}

export interface CreateTicketApiInput {
  title: string;
  description: string;
  category: string;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  priority?: "P4" | "P3" | "P2" | "P1";
}

export interface TicketReplyItem {
  id: string;
  ticketId: string;
  senderId: string;
  senderRole: string;
  message: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketResponseItem {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  priority: "P4" | "P3" | "P2" | "P1";
  status: "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "USER_CONFIRMATION" | "CLOSED" | "REOPENED" | "ESCALATED";
  userId: string;
  technicianId?: string | null;
  aiConfidence?: number | null;
  attemptedActions?: string[];
  failedActions?: string[];
  ragSources?: string[];
  escalationReason?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  replies?: TicketReplyItem[];
}

export interface ListTicketsResponse {
  tickets: TicketResponseItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function createTicketApi(input: CreateTicketApiInput) {
  const response = await api.post<TicketResponseItem>("/tickets", input);
  return response.data;
}

export async function listTicketsApi(params?: { status?: string; page?: number; limit?: number }) {
  const response = await api.get<ListTicketsResponse>("/tickets", { params });
  return response.data;
}

export async function getTicketByIdApi(id: string) {
  const response = await api.get<TicketResponseItem>(`/tickets/${id}`);
  return response.data;
}

export async function updateTicketApi(id: string, input: { status?: string; severity?: string; priority?: string; technicianId?: string }) {
  const response = await api.put<TicketResponseItem>(`/tickets/${id}`, input);
  return response.data;
}

export async function addTicketReplyApi(ticketId: string, message: string) {
  const response = await api.post<TicketReplyItem>(`/tickets/${ticketId}/replies`, { message });
  return response.data;
}

/* ------------------------------------------------------------------ */
/*  Troubleshooting Sessions                                          */
/* ------------------------------------------------------------------ */

export interface TroubleshootingStep {
  stepNumber: number;
  actionId: string;
  actionName: string;
  description: string;
  reason?: string;
  expectedOutcome?: string;
  riskLevel: "low" | "medium" | "high";
  outcome: "PENDING" | "SUCCESS" | "FAILURE" | "SKIPPED";
  userFeedback?: string;
  aiConfidence?: number;
  ragSourcesUsed: string[];
  completedAt?: string | null;
}

export interface TroubleshootingSessionItem {
  id: string;
  userId: string;
  conversationId?: string | null;
  problemDescription: string;
  category: string;
  severity: string;
  status: "ACTIVE" | "RESOLVED" | "ESCALATED" | "ABANDONED";
  steps: TroubleshootingStep[];
  currentStepNumber: number;
  totalStepsAttempted: number;
  aiConfidence: number;
  escalationReason?: string | null;
  ticketId?: string | null;
  resolutionSummary?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StartSessionResponse {
  session: TroubleshootingSessionItem;
  decision: {
    action: { actionId: string; name: string; description: string; expectedOutcome: string; riskLevel: string } | null;
    score: number;
    confidence: number;
    shouldEscalate: boolean;
    escalationReason?: string;
    reason: string;
  };
}

export interface StepOutcomeResponse {
  session: TroubleshootingSessionItem;
  nextAction: any | null;
  resolved?: boolean;
  escalated?: boolean;
  escalationReason?: string;
  ticketId?: string;
}

export async function startTroubleshootingSession(input: {
  problemDescription: string;
  category?: string;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}) {
  const response = await api.post<StartSessionResponse>("/sessions", input);
  return response.data;
}

export async function listTroubleshootingSessions(status?: string) {
  const response = await api.get<{ sessions: TroubleshootingSessionItem[] }>("/sessions", {
    params: status ? { status } : undefined
  });
  return response.data.sessions;
}

export async function getTroubleshootingSession(sessionId: string) {
  const response = await api.get<{ session: TroubleshootingSessionItem }>(`/sessions/${sessionId}`);
  return response.data.session;
}

export async function submitStepOutcomeApi(sessionId: string, stepNumber: number, input: {
  outcome: "SUCCESS" | "FAILURE" | "SKIPPED";
  userFeedback?: string;
}) {
  const response = await api.post<StepOutcomeResponse>(
    `/sessions/${sessionId}/steps/${stepNumber}/outcome`,
    input
  );
  return response.data;
}

export async function getDashboardStats() {
  const response = await api.get<{
    activeSessions: number;
    resolvedSessions: number;
    escalatedSessions: number;
    openTickets: number;
    pendingTickets: number;
    totalTickets: number;
  }>("/sessions/stats");
  return response.data;
}

/* ------------------------------------------------------------------ */
/*  Notifications                                                      */
/* ------------------------------------------------------------------ */

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  relatedTicketId?: string | null;
  relatedSessionId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export async function listNotificationsApi(unreadOnly?: boolean) {
  const response = await api.get<{ notifications: NotificationItem[] }>("/notifications", {
    params: unreadOnly ? { unreadOnly: "true" } : undefined
  });
  return response.data.notifications;
}

export async function getUnreadCountApi() {
  const response = await api.get<{ count: number }>("/notifications/unread-count");
  return response.data.count;
}

export async function markNotificationReadApi(notificationId: string) {
  const response = await api.put(`/notifications/${notificationId}/read`);
  return response.data;
}

export async function markAllNotificationsReadApi() {
  const response = await api.put("/notifications/read-all");
  return response.data;
}

/* ------------------------------------------------------------------ */
/*  Profile                                                            */
/* ------------------------------------------------------------------ */

export async function updateProfileApi(data: { name?: string; department?: string; phone?: string }) {
  const response = await api.put<{ user: AuthUser }>("/auth/profile", data);
  return response.data.user;
}

/* ------------------------------------------------------------------ */
/*  Staff / Technician Workbench APIs                                 */
/* ------------------------------------------------------------------ */

export interface StaffOverviewStats {
  assignedTickets: number;
  openTickets: number;
  inProgress: number;
  waitingForUser: number;
  resolvedToday: number;
  highPriorityTickets: number;
  totalTickets: number;
}

export interface StaffTicketItem {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  priority: "P1" | "P2" | "P3" | "P4";
  status: "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "WAITING_FOR_USER" | "RESOLVED" | "CLOSED" | "REOPENED" | "ESCALATED";
  userId: string;
  userName: string;
  userEmail: string;
  userDepartment?: string;
  userPhone?: string;
  technicianId?: string | null;
  technicianName?: string | null;
  aiConfidence: number;
  attemptedActions: string[];
  failedActions: string[];
  ragSources: string[];
  escalationReason: string;
  assignedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  technicianActionsCount?: number;
  resolution?: {
    summary?: string;
    rootCause?: string;
    actionsTaken?: string[];
    kbRecommendation?: string;
    resolvedBy?: string;
    resolvedByName?: string;
    resolvedAt?: string;
  };
}

export interface StaffTicketDetailsResponse {
  ticket: StaffTicketItem;
  userInfo: {
    id: string;
    name: string;
    email: string;
    department: string;
    phone: string;
  };
  problem: {
    title: string;
    description: string;
    category: string;
    severity: string;
    priority: string;
  };
  aiTroubleshootingHistory: {
    confidence: number;
    attemptedActions: string[];
    failedActions: string[];
    successfulActions: string[];
    steps: Array<{
      stepNumber: number;
      actionName: string;
      description: string;
      reason?: string;
      expectedOutcome?: string;
      riskLevel?: string;
      outcome: string;
      userFeedback?: string;
      completedAt?: string | null;
    }>;
    conversation: Array<{
      role: string;
      content: string;
      createdAt: string;
    }>;
  };
  ragInfo: {
    sources: Array<{
      chunkId: string;
      title: string;
      relevance: number;
      procedure?: string;
    }>;
  };
  escalationInfo: {
    reason: string;
    confidence: number;
    attemptsCount: number;
    lastAttemptedAction: string;
  };
  resolution?: {
    summary: string;
    rootCause?: string;
    actionsTaken: string[];
    kbRecommendation?: string;
    resolvedByName?: string;
    resolvedAt?: string | null;
  } | null;
  technicianActions: Array<{
    id: string;
    action: string;
    notes?: string;
    outcome: "SUCCESS" | "FAILED" | "PARTIAL" | "INVESTIGATING";
    performedByName?: string;
    createdAt: string;
  }>;
  replies: Array<{
    id: string;
    senderId: string;
    senderName?: string;
    senderRole: string;
    message: string;
    createdAt: string;
  }>;
}

export interface TechnicianProfileData {
  id: string;
  userId: string;
  name: string;
  email: string;
  department: string;
  phone: string;
  skills: string[];
  availability: "AVAILABLE" | "BUSY" | "OFFLINE";
  workload: number;
  capacity: number;
  averageResolutionHours: number;
  stats: {
    activeTickets: number;
    resolvedTickets: number;
    highPriorityAssigned: number;
  };
}

export interface AssignmentRecommendationResponse {
  decision: AssignmentDecision;
  recommendedTechnician: {
    id: string;
    name?: string;
    skills: string[];
    availability: string;
    workload: number;
    capacity: number;
  } | null;
}

export async function getStaffOverviewApi(): Promise<StaffOverviewStats> {
  const response = await api.get<StaffOverviewStats>("/staff/overview");
  return response.data;
}

export async function listStaffTicketsApi(params?: {
  assignedToMe?: boolean;
  status?: string;
  priority?: string;
  category?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}): Promise<{ tickets: StaffTicketItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const response = await api.get("/staff/tickets", { params });
  return response.data;
}

export async function getStaffTicketDetailsApi(ticketId: string): Promise<StaffTicketDetailsResponse> {
  const response = await api.get<StaffTicketDetailsResponse>(`/staff/tickets/${ticketId}`);
  return response.data;
}

export async function acceptStaffTicketApi(ticketId: string): Promise<any> {
  const response = await api.post(`/staff/tickets/${ticketId}/accept`);
  return response.data;
}

export async function startWorkStaffTicketApi(ticketId: string): Promise<any> {
  const response = await api.post(`/staff/tickets/${ticketId}/start-work`);
  return response.data;
}

export async function addStaffActionApi(ticketId: string, input: {
  action: string;
  notes?: string;
  outcome?: "SUCCESS" | "FAILED" | "PARTIAL" | "INVESTIGATING";
}): Promise<any> {
  const response = await api.post(`/staff/tickets/${ticketId}/action`, input);
  return response.data;
}

export async function requestStaffInfoApi(ticketId: string, message: string): Promise<any> {
  const response = await api.post(`/staff/tickets/${ticketId}/request-info`, { message });
  return response.data;
}

export async function updateStaffPriorityApi(ticketId: string, priority: "P1" | "P2" | "P3" | "P4"): Promise<any> {
  const response = await api.put(`/staff/tickets/${ticketId}/priority`, { priority });
  return response.data;
}

export async function updateStaffStatusApi(ticketId: string, status: string): Promise<any> {
  const response = await api.put(`/staff/tickets/${ticketId}/status`, { status });
  return response.data;
}

export async function resolveStaffTicketApi(ticketId: string, input: {
  summary: string;
  rootCause?: string;
  actionsTaken: string[];
  kbRecommendation?: string;
}): Promise<any> {
  const response = await api.post(`/staff/tickets/${ticketId}/resolve`, input);
  return response.data;
}

export async function reopenStaffTicketApi(ticketId: string, reason?: string): Promise<any> {
  const response = await api.post(`/staff/tickets/${ticketId}/reopen`, { reason });
  return response.data;
}

export async function getStaffAssignmentRecommendationApi(ticketId: string): Promise<AssignmentRecommendationResponse> {
  const response = await api.get<AssignmentRecommendationResponse>(`/staff/tickets/${ticketId}/recommendation`);
  return response.data;
}

export async function autoAssignStaffTicketApi(ticketId: string): Promise<any> {
  const response = await api.post(`/staff/tickets/${ticketId}/auto-assign`);
  return response.data;
}

export async function getStaffProfileApi(userId?: string): Promise<TechnicianProfileData> {
  const response = await api.get<TechnicianProfileData>("/staff/profile", {
    params: userId ? { userId } : undefined
  });
  return response.data;
}

export async function updateStaffProfileApi(input: {
  availability?: "AVAILABLE" | "BUSY" | "OFFLINE";
  skills?: string[];
  phone?: string;
  department?: string;
}): Promise<TechnicianProfileData> {
  const response = await api.put<TechnicianProfileData>("/staff/profile", input);
  return response.data;
}

/* ================================================================== */
/*  ADMIN DASHBOARD APIs                                              */
/* ================================================================== */

export interface AdminOverviewStats {
  totalUsers: number;
  activeUsers: number;
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  aiResolved: number;
  humanResolved: number;
  escalatedTickets: number;
  averageResolutionHours: number;
  totalStaff: number;
  totalKnowledgeDocs: number;
  approvedKnowledgeDocs: number;
  ragChunkCount: number;
  storageMode: string;
}

export interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  role: "USER" | "STAFF" | "TECHNICIAN" | "ADMIN";
  department?: string;
  phone?: string;
  active: boolean;
  ticketsCount?: number;
  sessionsCount?: number;
  createdAt: string;
}

export interface AdminStaffRecord {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  department: string;
  phone?: string;
  active: boolean;
  skills: string[];
  availability: "AVAILABLE" | "BUSY" | "OFFLINE";
  workload: number;
  capacity: number;
  averageResolutionHours: number;
  activeTicketsCount: number;
  assignedTickets?: Array<{ id: string; title: string; priority: string; status: string }>;
}

export interface StaffLoginRequestRecord {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  department: string;
  phone?: string;
  status: "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "DISABLED";
  active: boolean;
  profileImage?: string;
  staffRequestedAt?: string;
  staffReviewedAt?: string;
  staffReviewedBy?: string;
  createdAt: string;
}

export interface AdminTicketRecord {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  priority: "P1" | "P2" | "P3" | "P4";
  status: string;
  userId: string;
  userName: string;
  userEmail: string;
  userDepartment?: string;
  technicianId?: string | null;
  technicianName?: string | null;
  aiConfidence?: number;
  attemptedActions?: string[];
  failedActions?: string[];
  ragSources?: string[];
  escalationReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminKnowledgeRecord {
  id: string;
  title: string;
  category: string;
  department: string;
  version: string;
  content: string;
  chunkCount: number;
  status: "PROCESSING" | "READY" | "FAILED" | "ARCHIVED";
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  createdBy?: string;
  createdByName?: string;
  approvedByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAiRagTelemetry {
  aiResolutionRate: number;
  escalationRate: number;
  ragRetrievalSuccessRate: number;
  lowConfidenceRate: number;
  recentSessions: Array<{
    id: string;
    problemDescription: string;
    category: string;
    status: string;
    stepsAttempted: number;
    aiConfidence: number;
    escalationReason?: string | null;
    lastAction?: string;
    userName?: string;
    createdAt: string;
  }>;
  failedActions: Array<{
    action: string;
    failureCount: number;
    category: string;
  }>;
  retrievalTelemetry: {
    totalRetrievals: number;
    averageRelevance: number;
    retrievalFailures: number;
  };
}

export interface AdminAnalyticsData {
  aiResolutionRate: number;
  escalationRate: number;
  avgResolutionTimeHours: number;
  ticketsByCategory: Array<{ category: string; count: number }>;
  ticketsByPriority: Array<{ priority: string; count: number }>;
  ticketsByStatus: Array<{ status: string; count: number }>;
  aiVsHumanResolution: {
    aiResolved: number;
    humanResolved: number;
    totalResolved: number;
  };
  commonProblems: Array<{ problem: string; count: number }>;
  failedTroubleshootingActions: Array<{ action: string; failures: number }>;
  researchMetrics: {
    aiResolutionRate: number;
    escalationRate: number;
    averageTroubleshootingSteps: number;
    averageResolutionHours: number;
    successfulActionRate: number;
    failedActionRate: number;
    ragRetrievalSuccessRate: number;
    lowConfidenceEscalationRate: number;
  };
}

export interface AdminSystemSettings {
  categories: string[];
  prioritySlaHours: Record<string, number>;
  escalationRules: {
    maxAiStepsBeforeEscalation: number;
    aiConfidenceThreshold: number;
    autoEscalateCritical: boolean;
  };
  departments: string[];
  availableSkills: string[];
  notificationSettings: {
    emailAlertsEnabled: boolean;
    soundAlertsEnabled: boolean;
    notifyOnHighPriority: boolean;
  };
}

export interface AdminAuditLogRecord {
  id: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details: string;
  metadata?: any;
  createdAt: string;
}

export async function getAdminOverviewApi(): Promise<AdminOverviewStats> {
  const response = await api.get<AdminOverviewStats>("/admin/overview");
  return response.data;
}

export async function listAdminUsersApi(params?: {
  search?: string;
  role?: string;
  active?: boolean;
  department?: string;
  page?: number;
  limit?: number;
}): Promise<{ users: AdminUserRecord[]; pagination: any }> {
  const response = await api.get<{ users: AdminUserRecord[]; pagination: any }>("/admin/users", { params });
  return response.data;
}

export async function createAdminUserApi(data: {
  name: string;
  email: string;
  password?: string;
  role?: string;
  department?: string;
  phone?: string;
}): Promise<AdminUserRecord> {
  const response = await api.post<AdminUserRecord>("/admin/users", data);
  return response.data;
}

export async function updateAdminUserApi(id: string, data: Partial<AdminUserRecord>): Promise<any> {
  const response = await api.put(`/admin/users/${id}`, data);
  return response.data;
}

export async function toggleAdminUserStatusApi(id: string, active: boolean): Promise<any> {
  const response = await api.put(`/admin/users/${id}/status`, { active });
  return response.data;
}

export async function getAdminUserTicketsApi(id: string): Promise<{ tickets: any[]; sessions: any[] }> {
  const response = await api.get(`/admin/users/${id}/tickets`);
  return response.data;
}

export async function listAdminStaffApi(params?: {
  search?: string;
  department?: string;
  availability?: string;
  page?: number;
  limit?: number;
}): Promise<{ staff: AdminStaffRecord[]; pagination: any }> {
  const response = await api.get<{ staff: AdminStaffRecord[]; pagination: any }>("/admin/staff", { params });
  return response.data;
}

export async function listAdminStaffRequestsApi(): Promise<{
  requests: StaffLoginRequestRecord[];
  pendingCount: number;
}> {
  const response = await api.get<{
    requests: StaffLoginRequestRecord[];
    pendingCount: number;
  }>("/admin/staff-requests");
  return response.data;
}

export async function reviewAdminStaffRequestApi(
  id: string,
  decision: "ACCEPT" | "REJECT",
  notes?: string
): Promise<{ success: boolean; decision: string; message: string; user?: any }> {
  const response = await api.put<{ success: boolean; decision: string; message: string; user?: any }>(
    `/admin/staff-requests/${id}/review`,
    { decision, notes }
  );
  return response.data;
}

export async function createAdminStaffApi(data: {
  name: string;
  email: string;
  password?: string;
  department?: string;
  phone?: string;
  skills?: string[];
  capacity?: number;
}): Promise<any> {
  const response = await api.post("/admin/staff", data);
  return response.data;
}

export async function updateAdminStaffApi(id: string, data: {
  name?: string;
  department?: string;
  phone?: string;
  skills?: string[];
  capacity?: number;
  availability?: "AVAILABLE" | "BUSY" | "OFFLINE";
  active?: boolean;
}): Promise<any> {
  const response = await api.put(`/admin/staff/${id}`, data);
  return response.data;
}

export async function listAdminTicketsApi(params?: {
  search?: string;
  status?: string;
  priority?: string;
  category?: string;
  technicianId?: string;
  department?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}): Promise<{ tickets: AdminTicketRecord[]; pagination: any }> {
  const response = await api.get<{ tickets: AdminTicketRecord[]; pagination: any }>("/admin/tickets", { params });
  return response.data;
}

export async function reassignAdminTicketApi(ticketId: string, technicianId: string | null): Promise<any> {
  const response = await api.put(`/admin/tickets/${ticketId}/reassign`, { technicianId });
  return response.data;
}

export async function adminUpdateTicketApi(ticketId: string, data: {
  priority?: string;
  status?: string;
  severity?: string;
}): Promise<any> {
  const response = await api.put(`/admin/tickets/${ticketId}`, data);
  return response.data;
}

export async function listAdminKnowledgeApi(params?: {
  search?: string;
  category?: string;
  approvalStatus?: string;
  status?: string;
}): Promise<{ documents: AdminKnowledgeRecord[] }> {
  const response = await api.get<{ documents: AdminKnowledgeRecord[] }>("/admin/knowledge", { params });
  return response.data;
}

export async function createAdminKnowledgeApi(data: {
  title: string;
  category: string;
  department?: string;
  version?: string;
  content: string;
  autoApprove?: boolean;
}): Promise<AdminKnowledgeRecord> {
  const response = await api.post<AdminKnowledgeRecord>("/admin/knowledge", data);
  return response.data;
}

export async function setAdminKnowledgeApprovalApi(
  id: string,
  approvalStatus: "APPROVED" | "REJECTED" | "PENDING"
): Promise<any> {
  const response = await api.put(`/admin/knowledge/${id}/approval`, { approvalStatus });
  return response.data;
}

export async function archiveAdminKnowledgeApi(id: string): Promise<any> {
  const response = await api.put(`/admin/knowledge/${id}/archive`);
  return response.data;
}

export async function deleteAdminKnowledgeApi(id: string): Promise<any> {
  const response = await api.delete(`/admin/knowledge/${id}`);
  return response.data;
}

export async function getAdminAiRagMonitoringApi(): Promise<AdminAiRagTelemetry> {
  const response = await api.get<AdminAiRagTelemetry>("/admin/monitoring/ai-rag");
  return response.data;
}

export async function getAdminAnalyticsApi(): Promise<AdminAnalyticsData> {
  const response = await api.get<AdminAnalyticsData>("/admin/analytics");
  return response.data;
}

export async function getAdminSettingsApi(): Promise<AdminSystemSettings> {
  const response = await api.get<AdminSystemSettings>("/admin/settings");
  return response.data;
}

export async function updateAdminSettingApi(key: string, value: any): Promise<any> {
  const response = await api.put(`/admin/settings/${key}`, { value });
  return response.data;
}

export async function listAdminAuditLogsApi(params?: {
  action?: string;
  resourceType?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ logs: AdminAuditLogRecord[]; pagination: any }> {
  const response = await api.get<{ logs: AdminAuditLogRecord[]; pagination: any }>("/admin/audit-logs", { params });
  return response.data;
}

/* ------------------------------------------------------------------ */
/*  Phase 16: Duplicate Incident Detection & Cluster APIs             */
/* ------------------------------------------------------------------ */

export interface DuplicateDetectionCandidate {
  ticketId: string;
  title: string;
  category: string;
  status: string;
  severity: string;
  similarity: number;
  matchedKeywords: string[];
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
  recommendation: string;
  createdAt: string;
}

export interface IncidentCluster {
  id: string;
  category: string;
  keywords: string[];
  ticketCount: number;
  tickets: Array<{ id: string; title: string; createdAt: string; status: string }>;
  isPotentialOutage: boolean;
  severity: string;
  firstReportedAt: string;
  latestReportedAt: string;
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  highestSimilarity: number;
  candidates: DuplicateDetectionCandidate[];
  potentialOutage: boolean;
  cluster?: IncidentCluster;
  analysis: string;
}

export async function detectDuplicateIncidentsApi(data: {
  title: string;
  description: string;
  category?: string;
  excludeTicketId?: string;
}): Promise<DuplicateDetectionResult> {
  const response = await api.post<DuplicateDetectionResult>("/incidents/detect-duplicate", data);
  return response.data;
}

export async function getIncidentClustersApi(): Promise<{ clusters: IncidentCluster[] }> {
  const response = await api.get<{ clusters: IncidentCluster[] }>("/incidents/clusters");
  return response.data;
}

export async function linkDuplicateTicketApi(
  ticketId: string,
  targetTicketId: string,
  note?: string
): Promise<{ success: boolean; message: string }> {
  const response = await api.post<{ success: boolean; message: string }>("/incidents/link-duplicate", {
    ticketId,
    targetTicketId,
    note
  });
  return response.data;
}

/* ------------------------------------------------------------------ */
/*  Phase 17 & 19: Root-Cause Analytics & Research Ablation APIs     */
/* ------------------------------------------------------------------ */

export interface RootCauseStat {
  rootCause: string;
  category: string;
  count: number;
  percentage: number;
  resolvedByAi: number;
  resolvedByHuman: number;
  avgResolutionMinutes: number;
}

export interface ActionEffectivenessStat {
  actionId: string;
  actionName: string;
  category: string;
  riskLevel: string;
  totalAttempts: number;
  successCount: number;
  failureCount: number;
  skipCount: number;
  successRate: number;
  avgExecutionSeconds: number;
}

export interface AblationBenchmarkRow {
  method: string;
  sampleSize: number;
  resolutionRate: number;
  ticketReductionRate: number;
  avgAttempts: number;
  avgResolutionMinutes: number;
  escalationRate: number;
  repeatedActionRate: number;
  userSatisfaction: number;
}

export interface ComprehensiveAnalyticsOverview {
  aiResolutionRate: number;
  ticketReductionRate: number;
  escalationRate: number;
  duplicateIncidentRate: number;
  avgTroubleshootingAttempts: number;
  avgResolutionTimeMinutes: number;
  totalSessionsAnalyzed: number;
  totalTicketsAnalyzed: number;
  potentialOutagesActive: number;
  rootCauses: RootCauseStat[];
  actionEffectiveness: ActionEffectivenessStat[];
  ablationBenchmarks: AblationBenchmarkRow[];
  clusters: IncidentCluster[];
}

export async function getComprehensiveAnalyticsApi(): Promise<ComprehensiveAnalyticsOverview> {
  const response = await api.get<ComprehensiveAnalyticsOverview>("/analytics/overview");
  return response.data;
}

export async function simulateAblationBenchmarkApi(params: {
  sampleSize?: number;
  problemDiversity?: number;
  historicalLearningRate?: number;
}): Promise<{ results: AblationBenchmarkRow[] }> {
  const response = await api.post<{ results: AblationBenchmarkRow[] }>("/analytics/simulate", params);
  return response.data;
}



