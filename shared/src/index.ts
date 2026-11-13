export type UserRole = "USER" | "STAFF" | "TECHNICIAN" | "ADMIN";
export type TicketStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "WAITING_FOR_USER"
  | "RESOLVED"
  | "USER_CONFIRMATION"
  | "CLOSED"
  | "REOPENED"
  | "ESCALATED";
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Priority = "P4" | "P3" | "P2" | "P1";
export type RiskLevel = "low" | "medium" | "high";
export type ActionOutcomeResult = "SUCCESS" | "FAILURE" | "SKIPPED" | "UNKNOWN";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  googleId?: string;
  profileImage?: string;
  status?: string;
  staffRequestedAt?: string;
  staffReviewedAt?: string;
  department?: string;
  phone?: string;
  active: boolean;
  lastLogin?: string;
}


export interface AuthSession {
  user: AuthenticatedUser;
  token: string;
}

export interface TicketRecord {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: Severity;
  priority: Priority;
  status: TicketStatus;
  userId: string;
  technicianId?: string;
  aiConfidence?: number;
  attemptedActions: string[];
  failedActions: string[];
  ragSources: string[];
  escalationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TechnicianProfile {
  id: string;
  userId: string;
  skills: string[];
  availability: "AVAILABLE" | "BUSY" | "OFFLINE";
  workload: number;
  capacity: number;
  averageResolutionHours: number;
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

export interface TroubleshootingAction {
  actionId: string;
  name: string;
  description: string;
  category: string;
  riskLevel: RiskLevel;
  prerequisites: string[];
  expectedOutcome: string;
  allowedRoles: UserRole[];
  active: boolean;
}

export interface ActionOutcome {
  problemCategory: string;
  problemType: string;
  actionId: string;
  context: Record<string, unknown>;
  result: ActionOutcomeResult;
  resolutionTimeSeconds: number;
  aiConfidence: number;
  userFeedback?: number;
  timestamp: string;
}

export interface AdaptiveDecision {
  action: TroubleshootingAction | null;
  score: number;
  confidence: number;
  expectedSuccess: number;
  risk: RiskLevel;
  reason: string;
  shouldEscalate: boolean;
  escalationReason?: string;
  explanation: {
    historicalSuccess: number;
    problemSimilarity: number;
    contextMatch: number;
    ragRelevance: number;
    aiConfidence: number;
    previousFailurePenalty: number;
    riskPenalty: number;
  };
}

export interface ScoringWeights {
  historicalWeight: number;
  similarityWeight: number;
  contextWeight: number;
  ragWeight: number;
  confidenceWeight: number;
  failurePenalty: number;
  riskPenalty: number;
}

export interface DuplicateDetectionCandidate {
  ticketId: string;
  title: string;
  category: string;
  status: TicketStatus;
  severity: Severity;
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
  tickets: Array<{ id: string; title: string; createdAt: string; status: TicketStatus }>;
  isPotentialOutage: boolean;
  severity: Severity;
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
  riskLevel: RiskLevel;
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

export interface AblationSimulationInput {
  sampleSize?: number;
  problemDiversity?: number;
  historicalLearningRate?: number;
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

