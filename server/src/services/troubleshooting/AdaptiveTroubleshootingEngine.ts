import type {
  ActionOutcome,
  AdaptiveDecision,
  ScoringWeights,
  Severity,
  TroubleshootingAction
} from "@resolveai/shared";
import { defaultAutonomyThresholds } from "../../config/scoring.js";

interface RagResult {
  actionId?: string;
  relevance: number;
}

interface SelectActionInput {
  problemDescription: string;
  category: string;
  context: Record<string, unknown>;
  previousActions: string[];
  failedActions: string[];
  ragResults: RagResult[];
  historicalOutcomes: ActionOutcome[];
  aiConfidence: number;
  severity: Severity;
}

export const approvedDevelopmentActions: TroubleshootingAction[] = [
  // --- Network & Wi-Fi ---
  {
    actionId: "check_other_devices",
    name: "Check other devices on network",
    description: "Verify if another device (like a phone or colleague's PC) connected to the same Wi-Fi can access the internet.",
    category: "network",
    riskLevel: "low",
    prerequisites: ["User has access to a secondary device or asks nearby colleague"],
    expectedOutcome: "Isolates whether the outage is device-specific or network/access-point wide.",
    allowedRoles: ["USER", "TECHNICIAN"],
    active: true
  },
  {
    actionId: "check_gateway_ping",
    name: "Verify IP address and network gateway",
    description: "Open Command Prompt and check IP address configuration and ping the default gateway (`ipconfig` and `ping <gateway>`).",
    category: "network",
    riskLevel: "low",
    prerequisites: ["Command Prompt access"],
    expectedOutcome: "Confirms valid local IP assignment and router reachability.",
    allowedRoles: ["USER", "TECHNICIAN"],
    active: true
  },
  {
    actionId: "flush_dns_renew_ip",
    name: "Flush DNS cache and renew IP lease",
    description: "Clear corrupt DNS resolver entries and request fresh DHCP lease (`ipconfig /flushdns` and `ipconfig /renew`).",
    category: "network",
    riskLevel: "low",
    prerequisites: ["Command Prompt"],
    expectedOutcome: "DNS resolution is restored and clean IP configuration obtained.",
    allowedRoles: ["USER", "TECHNICIAN"],
    active: true
  },
  {
    actionId: "restart_adapter",
    name: "Restart network adapter",
    description: "Disable and re-enable the device network adapter in Network Connections (`ncpa.cpl`).",
    category: "network",
    riskLevel: "low",
    prerequisites: ["User has local device access"],
    expectedOutcome: "Network adapter reinitializes and reconnects.",
    allowedRoles: ["USER", "TECHNICIAN"],
    active: true
  },
  {
    actionId: "forget_network",
    name: "Forget and reconnect Wi-Fi network",
    description: "Remove the saved Wi-Fi profile, then reconnect with verified credentials.",
    category: "network",
    riskLevel: "low",
    prerequisites: ["User knows Wi-Fi credentials"],
    expectedOutcome: "Device creates a clean Wi-Fi profile.",
    allowedRoles: ["USER", "TECHNICIAN"],
    active: true
  },
  {
    actionId: "reset_network",
    name: "Reset TCP/IP and network settings",
    description: "Reset TCP/IP stack and Winsock catalog (`netsh int ip reset` and `netsh winsock reset`).",
    category: "network",
    riskLevel: "medium",
    prerequisites: ["User can restart the device afterward"],
    expectedOutcome: "Corrupt network configuration is cleared.",
    allowedRoles: ["USER", "TECHNICIAN"],
    active: true
  },

  // --- Corporate VPN ---
  {
    actionId: "verify_vpn_internet_baseline",
    name: "Verify baseline internet without VPN",
    description: "Confirm standard internet browsing functions without the VPN active before testing the tunnel.",
    category: "vpn",
    riskLevel: "low",
    prerequisites: ["Disconnect VPN temporarily"],
    expectedOutcome: "Confirms baseline connectivity is intact.",
    allowedRoles: ["USER", "TECHNICIAN"],
    active: true
  },
  {
    actionId: "reauth_vpn_mfa",
    name: "Re-authenticate VPN credentials and MFA",
    description: "Log out of the corporate VPN client completely, re-enter corporate username and approve fresh MFA prompt.",
    category: "vpn",
    riskLevel: "low",
    prerequisites: ["Active MFA authenticator device"],
    expectedOutcome: "Authentication token refreshes successfully.",
    allowedRoles: ["USER", "TECHNICIAN"],
    active: true
  },
  {
    actionId: "switch_vpn_gateway",
    name: "Switch VPN gateway / protocol",
    description: "Change VPN server endpoint to an alternate regional gateway or toggle tunnel protocol.",
    category: "vpn",
    riskLevel: "low",
    prerequisites: ["Client supports gateway selection"],
    expectedOutcome: "Tunnel establishes on alternate server.",
    allowedRoles: ["USER", "TECHNICIAN"],
    active: true
  },
  {
    actionId: "restart_vpn_service",
    name: "Restart VPN background service",
    description: "Restart the VPN client daemon service in Windows Services (`services.msc`).",
    category: "vpn",
    riskLevel: "medium",
    prerequisites: ["Local administrator rights"],
    expectedOutcome: "Stalled virtual adapter service reinitializes.",
    allowedRoles: ["TECHNICIAN"],
    active: true
  },

  // --- Hardware & Printers ---
  {
    actionId: "check_printer_status_power",
    name: "Verify printer power, network, and paper status",
    description: "Inspect physical printer screen, verify power/sleep state, check network status light, and ensure no paper jam or ink error.",
    category: "hardware",
    riskLevel: "low",
    prerequisites: ["Physical proximity to printer"],
    expectedOutcome: "Printer hardware shows 'Ready' without error codes.",
    allowedRoles: ["USER", "TECHNICIAN"],
    active: true
  },
  {
    actionId: "clear_queue_restart_spooler",
    name: "Clear print queue and restart Print Spooler",
    description: "Cancel stuck printing jobs and restart Windows Print Spooler service (`net stop spooler && net start spooler`).",
    category: "hardware",
    riskLevel: "low",
    prerequisites: ["Access to print queue"],
    expectedOutcome: "Corrupt queued print job is purged and spooling resumes.",
    allowedRoles: ["USER", "TECHNICIAN"],
    active: true
  },
  {
    actionId: "reinstall_printer_connection",
    name: "Remove and re-add printer device",
    description: "Remove the printer device in Windows Settings and re-add via network discovery or IP address.",
    category: "hardware",
    riskLevel: "medium",
    prerequisites: ["Printer IP address or network share name"],
    expectedOutcome: "Printer port and driver re-bind correctly.",
    allowedRoles: ["USER", "TECHNICIAN"],
    active: true
  },

  // --- Software & Email (Outlook) ---
  {
    actionId: "check_webmail_baseline",
    name: "Verify webmail access in browser",
    description: "Sign into Outlook on the Web via browser to verify mailbox health and credentials independently of local client.",
    category: "software",
    riskLevel: "low",
    prerequisites: ["Web browser"],
    expectedOutcome: "Isolates whether issue is server-side mailbox vs local client app.",
    allowedRoles: ["USER", "TECHNICIAN"],
    active: true
  },
  {
    actionId: "toggle_outlook_work_offline",
    name: "Check Work Offline mode & manually sync",
    description: "Ensure 'Work Offline' is turned off in Outlook Send/Receive tab and trigger manual 'Send/Receive All Folders'.",
    category: "software",
    riskLevel: "low",
    prerequisites: ["Outlook open"],
    expectedOutcome: "Outlook reconnects to Exchange server.",
    allowedRoles: ["USER", "TECHNICIAN"],
    active: true
  },
  {
    actionId: "clear_credential_manager_tokens",
    name: "Clear cached Outlook credentials in Credential Manager",
    description: "Remove stale generic Microsoft/Office credentials in Windows Credential Manager and re-authenticate.",
    category: "software",
    riskLevel: "medium",
    prerequisites: ["Windows Credential Manager"],
    expectedOutcome: "Clears auth loop and triggers fresh OAuth token.",
    allowedRoles: ["USER", "TECHNICIAN"],
    active: true
  },

  // --- Account & Access ---
  {
    actionId: "verify_account_caps_format",
    name: "Verify username syntax and Caps Lock",
    description: "Ensure corporate email formatting (UPN vs SAMAccountName) and Caps Lock / keyboard language.",
    category: "account",
    riskLevel: "low",
    prerequisites: ["Login screen"],
    expectedOutcome: "Prevents typo lockouts.",
    allowedRoles: ["USER", "TECHNICIAN"],
    active: true
  },
  {
    actionId: "use_sspr_portal",
    name: "Use Self-Service Password Reset (SSPR)",
    description: "Navigate to corporate SSPR portal to perform secure password reset or unlock.",
    category: "account",
    riskLevel: "low",
    prerequisites: ["Registered secondary MFA method"],
    expectedOutcome: "Account password updated and account unlocked.",
    allowedRoles: ["USER", "TECHNICIAN"],
    active: true
  },

  // --- System & Performance ---
  {
    actionId: "task_manager_resource_check",
    name: "Inspect Task Manager for hung processes",
    description: "Open Task Manager (`Ctrl+Shift+Esc`) to check CPU, RAM, and Disk utilization and terminate unresponsive apps.",
    category: "system",
    riskLevel: "low",
    prerequisites: ["Task Manager"],
    expectedOutcome: "Frees system memory and CPU cycles.",
    allowedRoles: ["USER", "TECHNICIAN"],
    active: true
  },
  {
    actionId: "clean_system_reboot",
    name: "Perform a clean system restart",
    description: "Save open work and perform a complete system reboot (`shutdown /r /t 0`).",
    category: "system",
    riskLevel: "low",
    prerequisites: ["Save user files"],
    expectedOutcome: "Clears memory leaks and resets background OS services.",
    allowedRoles: ["USER", "TECHNICIAN"],
    active: true
  }
];

export class AdaptiveTroubleshootingEngine {
  constructor(private readonly weights: ScoringWeights) {}

  selectNextAction(input: SelectActionInput): AdaptiveDecision {
    if (input.severity === "CRITICAL") {
      return this.escalate("Critical severity bypasses automated troubleshooting.", input.aiConfidence);
    }

    const candidates = approvedDevelopmentActions.filter(
      (action) => action.active && action.category === this.normalizeCategory(input.category)
    );

    const scored = candidates.map((action) => this.scoreAction(action, input)).sort((a, b) => b.score - a.score);
    const best = scored[0];

    if (!best) {
      return this.escalate("No approved troubleshooting action is available for this category.", input.aiConfidence);
    }

    if (input.failedActions.length >= defaultAutonomyThresholds.maxFailuresBeforeEscalation) {
      return { ...best, shouldEscalate: true, escalationReason: "Maximum failed automated attempts reached." };
    }

    if (best.confidence < defaultAutonomyThresholds.limitedTroubleshootingAt) {
      return { ...best, shouldEscalate: true, escalationReason: "Decision confidence is below the escalation threshold." };
    }

    return best;
  }

  private scoreAction(action: TroubleshootingAction, input: SelectActionInput): AdaptiveDecision {
    const historicalSuccess = this.historicalSuccess(action.actionId, input.historicalOutcomes);
    const problemSimilarity = this.simpleSimilarity(action.description, input.problemDescription);
    const contextMatch = this.contextMatch(action, input.context);
    const ragRelevance = this.ragRelevance(action.actionId, input.ragResults);
    const previousFailurePenalty = input.failedActions.includes(action.actionId) ? this.weights.failurePenalty : 0;
    const riskPenalty = this.riskPenalty(action);

    const positiveScore =
      historicalSuccess * this.weights.historicalWeight +
      problemSimilarity * this.weights.similarityWeight +
      contextMatch * this.weights.contextWeight +
      ragRelevance * this.weights.ragWeight +
      input.aiConfidence * this.weights.confidenceWeight;

    const score = this.clamp01(positiveScore - previousFailurePenalty - riskPenalty);
    const confidence = this.clamp01((score + input.aiConfidence) / 2);

    return {
      action,
      score,
      confidence,
      expectedSuccess: historicalSuccess,
      risk: action.riskLevel,
      reason: `Selected because score ${score.toFixed(2)} balances historical success, similarity, context, RAG relevance, confidence, prior failures, and risk.`,
      shouldEscalate: false,
      explanation: {
        historicalSuccess,
        problemSimilarity,
        contextMatch,
        ragRelevance,
        aiConfidence: input.aiConfidence,
        previousFailurePenalty,
        riskPenalty
      }
    };
  }

  private historicalSuccess(actionId: string, outcomes: ActionOutcome[]) {
    const matching = outcomes.filter((outcome) => outcome.actionId === actionId);
    if (matching.length === 0) return 0.5;
    return matching.filter((outcome) => outcome.result === "SUCCESS").length / matching.length;
  }

  private simpleSimilarity(left: string, right: string) {
    const leftTerms = new Set(left.toLowerCase().split(/\W+/).filter(Boolean));
    const rightTerms = new Set(right.toLowerCase().split(/\W+/).filter(Boolean));
    const overlap = [...leftTerms].filter((term) => rightTerms.has(term)).length;
    return this.clamp01(overlap / Math.max(leftTerms.size, 1));
  }

  private contextMatch(_action: TroubleshootingAction, context: Record<string, unknown>) {
    return Object.keys(context).length > 0 ? 0.7 : 0.4;
  }

  private ragRelevance(actionId: string, ragResults: RagResult[]) {
    const related = ragResults.filter((result) => result.actionId === actionId);
    if (related.length === 0) return 0.5;
    return Math.max(...related.map((result) => result.relevance));
  }

  private riskPenalty(action: TroubleshootingAction) {
    const multiplier = action.riskLevel === "high" ? 1 : action.riskLevel === "medium" ? 0.5 : 0;
    return this.weights.riskPenalty * multiplier;
  }

  private normalizeCategory(category: string) {
    return category.toLowerCase().includes("wi-fi") || category.toLowerCase().includes("wifi")
      ? "network"
      : category.toLowerCase();
  }

  private escalate(reason: string, aiConfidence: number): AdaptiveDecision {
    return {
      action: null,
      score: 0,
      confidence: aiConfidence,
      expectedSuccess: 0,
      risk: "high",
      reason,
      shouldEscalate: true,
      escalationReason: reason,
      explanation: {
        historicalSuccess: 0,
        problemSimilarity: 0,
        contextMatch: 0,
        ragRelevance: 0,
        aiConfidence,
        previousFailurePenalty: 0,
        riskPenalty: 0
      }
    };
  }

  private clamp01(value: number) {
    return Math.max(0, Math.min(1, value));
  }
}
