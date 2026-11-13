import type { ChatMessageRecord } from "@resolveai/shared";
import type { RagChunk } from "../rag/RagService.js";
import type { ChatState } from "./schema.js";

export interface ContextAnalysis {
  category: "network" | "hardware" | "software" | "vpn" | "account" | "system" | "other";
  primaryIssue: string;
  device?: string;
  os?: string;
  diagnosticFacts: {
    otherDevicesWork?: boolean;
    canReachGateway?: boolean;
    dnsFailed?: boolean;
    adapterRestarted?: boolean;
    alreadyRebooted?: boolean;
    printerOffline?: boolean;
    vpnInternetBaselineWorks?: boolean;
    outlookWebmailWorks?: boolean;
    userNeedsInstructionHelp?: boolean;
  };
  userIntent: "SOLVED" | "FAILED" | "ESCALATE" | "DIAGNOSTIC_OBSERVATION" | "NEED_HELP" | "NEW_INQUIRY";
  attemptedActions: string[];
  failedActions: string[];
  currentActionId?: string;
  semanticSearchQuery: string;
  wantsHuman: boolean;
  isCritical: boolean;
}

const categoryProcedures: Record<string, string[]> = {
  network: [
    "Step 1: First, toggle your Wi-Fi adapter off and on to re-establish connection. To narrow down whether this is an issue with the wireless network or specifically with your laptop, could you check whether another device (such as your phone or a colleague's laptop) connected to the same Wi-Fi can access the internet?",
    "Step 2: Let's check if the laptop has received a valid network address from the router. Press **Windows Key + R**, type `cmd` and press **Enter**. In Command Prompt, run `ipconfig` and check your Default Gateway, then run `ping` followed by that gateway address (e.g. `ping 192.168.1.1`). Did the gateway reply or time out?",
    "Step 3: Let's clear any corrupt DNS cache and request a fresh IP lease. In the Command Prompt window, type `ipconfig /flushdns` and press Enter, then type `ipconfig /renew` and press Enter. Does internet browsing resume after renewing the lease?",
    "Step 4: Let's reset your network adapter. Press **Windows Key + R**, type `ncpa.cpl` and press Enter to open Network Connections. Right-click your network adapter, select Disable, wait 10 seconds, then right-click and select Enable. Does your laptop reconnect to the internet?",
    "Step 5: Let's reset your TCP/IP stack and Winsock catalog. Open Command Prompt as Administrator and run `netsh int ip reset` followed by `netsh winsock reset`, then restart your computer. Did restarting restore normal connectivity?"
  ],
  vpn: [
    "Step 1: Disconnect the VPN client temporarily and confirm whether standard internet browsing works normally without the VPN active. What error message does the VPN client display?",
    "Step 2: Let's refresh your VPN credentials and authentication tokens. Completely quit the VPN client, verify that your computer's clock is set to automatic time sync, sign back into the client, and approve the fresh MFA push prompt. Does the tunnel connect?",
    "Step 3: Try switching to an alternate regional VPN server gateway or toggle the tunnel protocol in the VPN connection preferences. Does the alternate gateway establish a tunnel?",
    "Step 4: Let's restart the VPN background service. Press **Windows Key + R**, type `services.msc`, locate your corporate VPN daemon service, and click Restart. Does the service restart properly?",
    "Step 5: Reinstall the corporate VPN virtual adapter driver from Device Manager or run the client installation repair tool, then reboot your workstation. Did that resolve the tunnel error?"
  ],
  hardware: [
    "Step 1: Check the physical device and hardware status. Does the printer display 'Ready' or an error code, and is it showing as 'Offline' in your computer settings?",
    "Step 2: Let's restart the Windows Print Spooler service and clear any stuck jobs. Press **Windows Key + R**, type `services.msc`, right-click **Print Spooler**, select Restart, and clear any pending documents in the queue. Does a test page print?",
    "Step 3: Power cycle the hardware. Turn the device completely off, unplug power for 30 seconds, plug back in, and power on. Does the device come back online?",
    "Step 4: Remove and re-add the printer device. In Windows Settings > Printers & Scanners, remove the printer, click Add Device, and let Windows rediscover it on the local network. Does the re-added printer respond?",
    "Step 5: Reinstall the manufacturer print driver and verify the printer IP port configuration in printer properties. Did updating the driver fix the issue?"
  ],
  software: [
    "Step 1: Test application access independently. If this is an email or cloud app (such as Outlook), sign into the web version in your browser to verify whether your account and mailbox are functioning normally.",
    "Step 2: Restart the application in Safe Mode or clear application cache (for example, run `outlook.exe /safe`). Does the application launch cleanly without hanging?",
    "Step 3: Check Windows Credential Manager. Remove any stale generic Microsoft/Office credentials and re-authenticate with your corporate account. Does that clear the authentication loop?",
    "Step 4: Run an application repair. In Windows Settings > Installed Apps, select the application, click Modify or Advanced options, and choose Quick Repair. Does repairing resolve the problem?",
    "Step 5: Perform a clean uninstall and reinstall of the application, then restart your workstation. Did reinstalling resolve the issue?"
  ],
  account: [
    "Step 1: Verify your username syntax (e.g. `username@company.com`), ensure Caps Lock is off, and verify your keyboard layout.",
    "Step 2: Use the corporate Self-Service Password Reset (SSPR) portal to check your account status and unlock your profile using your registered secondary MFA method. Can you access the reset portal?",
    "Step 3: Clear your browser cache and cookies, or open an InPrivate/Incognito window to prevent cached credential loops. Does the login prompt accept your credentials?",
    "Step 4: Open your authenticator app, verify device clock synchronization, or try an alternate verification method (such as SMS or phone prompt). Does verification succeed?",
    "Step 5: Try signing in from an alternate trusted company device or network to rule out conditional access or IP blocking policies. Does sign-in succeed there?"
  ],
  system: [
    "Step 1: Open Task Manager (`Ctrl + Shift + Esc`) and check the CPU, Memory, and Disk tabs. Are any specific processes consuming unusually high resources?",
    "Step 2: Perform a clean system restart (`shutdown /r /t 0`) to terminate hung background services and flush system RAM. Does performance improve after rebooting?",
    "Step 3: Run the Windows System File Checker. Open Command Prompt as Administrator, type `sfc /scannow` and press Enter. Did it detect and repair any corrupt files?",
    "Step 4: Clear temporary system files using Windows Disk Cleanup and check your hard drive health using `chkdsk`. Does freeing storage space resolve the freezing?",
    "Step 5: Boot into Windows Safe Mode or check for pending Windows Updates. Did the system stabilize?"
  ],
  other: [
    "Step 1: Let's gather diagnostic details. What specific error message or unexpected behavior are you seeing, and did this start after a recent update or reboot?",
    "Step 2: Check for any recent system changes or updates, and try restarting the affected application or tool.",
    "Step 3: Run diagnostic checks and verify network and service connectivity for the affected tool.",
    "Step 4: Clear local cache and temporary configuration files associated with the service.",
    "Step 5: Restart the workstation cleanly and verify physical connections. Did that restore functionality?"
  ]
};

export class ConversationalEngine {
  /**
   * Analyzes chronological message history and extracts problem domain,
   * diagnostic facts, user intent, and synthesized RAG query.
   */
  analyzeConversation(messages: ChatMessageRecord[], previousState?: Partial<ChatState>): ContextAnalysis {
    const userMessages = messages.filter((m) => m.role === "user").map((m) => m.content);
    const fullConversationText = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
    const lastUserMessage = userMessages[userMessages.length - 1] ?? "";
    const loweredLast = lastUserMessage.toLowerCase();
    const loweredFull = fullConversationText.toLowerCase();

    // 1. Detect Category
    let category: ContextAnalysis["category"] = (previousState?.issue_category as any) || "other";
    if (category === "other" || !previousState?.issue_category) {
      if (/wi-?fi|internet|dns|gateway|ipconfig|network|ethernet|webpage|website|ping/i.test(loweredFull)) {
        category = "network";
      } else if (/vpn|tunnel|gateway error|handshake/i.test(loweredFull)) {
        category = "vpn";
      } else if (/printer|printing|spooler|paper|toner|display|monitor|screen|keyboard|mouse|hardware/i.test(loweredFull)) {
        category = "hardware";
      } else if (/outlook|email|teams|excel|word|software|office|sync/i.test(loweredFull)) {
        category = "software";
      } else if (/password|login|account|mfa|sso|authenticator|locked out/i.test(loweredFull)) {
        category = "account";
      } else if (/slow|freeze|frozen|fan|cpu|blue screen|crash|reboot|restart|system/i.test(loweredFull)) {
        category = "system";
      }
    }

    // 2. Detect Critical / Outage
    const isCritical = /production outage|server down|security incident|data loss|entire office down|all users affected|production.*is down|losing data/i.test(
      loweredFull
    );

    // 3. Detect Explicit Request for Human / Technician
    const wantsHuman = /human|technician|agent|representative|speak to someone|talk to someone|real person|raise ticket|open ticket|create ticket|escalate|need a technician/i.test(
      loweredLast
    );

    // 4. Diagnostic Facts Extraction
    const diagnosticFacts: ContextAnalysis["diagnosticFacts"] = {};

    if (/phone works|other device.*(work|connect)|colleague.*(work|connect)|phone is fine|phone can browse|yes.*phone/i.test(loweredFull)) {
      diagnosticFacts.otherDevicesWork = true;
    } else if (/no other device|phone (cannot|doesn't|fails)|all devices/i.test(loweredFull)) {
      diagnosticFacts.otherDevicesWork = false;
    }

    if (/gateway.*(timed out|fail|unreachable|cannot reach|error)|ping.*(100% loss|timed out|unreachable)/i.test(loweredFull)) {
      diagnosticFacts.canReachGateway = false;
    } else if (/gateway.*(reply|replies|reachable|works|passed)|ping.*0% loss/i.test(loweredFull)) {
      diagnosticFacts.canReachGateway = true;
    }

    if (/already restarted|already rebooted|tried restarting|already turned off and on/i.test(loweredFull)) {
      diagnosticFacts.alreadyRebooted = true;
    }

    if (/offline|paused|printer.*offline/i.test(loweredFull)) {
      diagnosticFacts.printerOffline = true;
    }

    if (/how do i|i don't know how|where is that|where do i find|can't find|what is that|can we try something else|confused|i am confused|i don't understand/i.test(loweredLast)) {
      diagnosticFacts.userNeedsInstructionHelp = true;
    }

    // 5. User Outcome Intent
    let userIntent: ContextAnalysis["userIntent"] = "NEW_INQUIRY";
    if (wantsHuman) {
      userIntent = "ESCALATE";
    } else if (/that worked|it worked|working now|fixed|good now|solved|connected now|all set|thank you.*(fixed|working)|that resolved/i.test(loweredLast)) {
      userIntent = "SOLVED";
    } else if (/didn't work|did not work|that didn't help|still not working|still having|still can't|failed|no luck|nothing happened|same problem|same issue|tried that already/i.test(loweredLast)) {
      userIntent = "FAILED";
    } else if (diagnosticFacts.userNeedsInstructionHelp) {
      userIntent = "NEED_HELP";
    } else if (userMessages.length > 1) {
      userIntent = "DIAGNOSTIC_OBSERVATION";
    }

    // 6. Track Attempted & Failed Actions
    const attemptedActions = [...(previousState?.completed_steps || [])];
    const failedActions = [...(previousState?.failed_steps || [])];

    if (userIntent === "FAILED" && previousState?.current_step) {
      const lastActionName = previousState.source_id || `Step ${previousState.current_step}`;
      if (!failedActions.includes(lastActionName)) {
        failedActions.push(lastActionName);
      }
    }

    // 7. Synthesize Semantic RAG Query
    const firstProblemMessage = userMessages[0] || lastUserMessage;
    let semanticSearchQuery = `${category} issue: ${firstProblemMessage}`;
    if (diagnosticFacts.otherDevicesWork !== undefined) {
      semanticSearchQuery += diagnosticFacts.otherDevicesWork ? " other devices connect" : " network-wide outage";
    }
    if (lastUserMessage && lastUserMessage !== firstProblemMessage) {
      semanticSearchQuery += ` ${lastUserMessage}`;
    }

    return {
      category,
      primaryIssue: firstProblemMessage,
      device: /laptop|macbook|thinkpad|dell|workstation|desktop|pc/i.exec(loweredFull)?.[0] || "device",
      os: /windows 11|windows 10|windows|macos|mac|linux|ubuntu/i.exec(loweredFull)?.[0] || "Windows",
      diagnosticFacts,
      userIntent,
      attemptedActions,
      failedActions,
      currentActionId: (previousState as any)?.current_action_id,
      semanticSearchQuery,
      wantsHuman,
      isCritical
    };
  }

  /**
   * Generates a context-aware conversational response grounded in approved knowledge,
   * dynamically advancing steps without repeating failed actions, and escalating when appropriate.
   */
  generateConversationalTurn(
    analysis: ContextAnalysis,
    messages: ChatMessageRecord[],
    ragChunks: RagChunk[],
    previousState?: Partial<ChatState>
  ): { replyText: string; state: ChatState } {
    // 1. Base state initialization
    const state: ChatState = {
      status: "troubleshooting",
      issue_category: analysis.category,
      issue_type: analysis.primaryIssue.slice(0, 80),
      device: analysis.device,
      operating_system: analysis.os,
      current_step: previousState?.current_step || 1,
      completed_steps: [...analysis.attemptedActions],
      failed_steps: [...analysis.failedActions],
      solved: false,
      escalate: false,
      assistant_reply: ""
    };

    // -------------------------------------------------------------------------
    // CASE 1: Critical Outage / Incident Detection
    // -------------------------------------------------------------------------
    if (analysis.isCritical) {
      state.status = "escalated";
      state.escalate = true;
      state.impact_scope = "organization_wide";
      state.reason_for_escalation = "Critical system or infrastructure incident detected from conversation.";
      state.assistant_reply =
        "This indicates a high-priority critical incident. I have immediately triggered an emergency P1 ticket and paged our on-call infrastructure operations engineers. A technician has been assigned and will connect with your team directly.";
      return { replyText: state.assistant_reply, state };
    }

    // -------------------------------------------------------------------------
    // CASE 2: User Explicitly Asks for Human / Technician
    // -------------------------------------------------------------------------
    if (analysis.wantsHuman) {
      state.status = "escalated";
      state.escalate = true;
      state.reason_for_escalation = "User requested direct human technician assistance.";
      state.assistant_reply =
        "Understood. I have logged an official support ticket and escalated this directly to our technical support desk. All the conversation history, diagnostics, and details you shared have been attached so you will not need to repeat anything. A technician will follow up with you shortly.";
      return { replyText: state.assistant_reply, state };
    }

    // -------------------------------------------------------------------------
    // CASE 3: Problem Successfully Resolved
    // -------------------------------------------------------------------------
    if (analysis.userIntent === "SOLVED") {
      state.status = "solved";
      state.solved = true;
      state.assistant_reply =
        "That's fantastic news! I'm glad that resolved the problem for you. I have recorded this successful outcome in our knowledge memory to help future team members with similar issues. Please feel free to reach out anytime if you need help with anything else!";
      return { replyText: state.assistant_reply, state };
    }

    // -------------------------------------------------------------------------
    // CASE 4: Step Progression Calculation
    // -------------------------------------------------------------------------
    let currentStep = previousState?.current_step || 1;

    if (analysis.userIntent === "FAILED" || analysis.userIntent === "NEED_HELP" || analysis.userIntent === "DIAGNOSTIC_OBSERVATION") {
      currentStep = (previousState?.current_step || 1) + 1;
    }

    state.current_step = currentStep;

    // -------------------------------------------------------------------------
    // CASE 5: Max Steps / Failures Exceeded -> Escalate
    // -------------------------------------------------------------------------
    if (currentStep > 5 || state.failed_steps.length >= 5) {
      state.status = "escalated";
      state.escalate = true;
      state.reason_for_escalation = "All approved automated troubleshooting steps have been exhausted.";
      state.assistant_reply =
        "Since the primary troubleshooting procedures did not restore normal operation on this device, I have automatically escalated this to an IT support ticket for hands-on technician investigation. A technician will review your case details and follow up with you shortly. You can track this under My Tickets.";
      return { replyText: state.assistant_reply, state };
    }

    // -------------------------------------------------------------------------
    // CASE 6: Verified RAG Knowledge from Previous Staff Resolutions
    // -------------------------------------------------------------------------
    const actionChunk = ragChunks.find(
      (c) =>
        (c.title.toLowerCase().startsWith("resolved:") || c.metadata?.source === "staff_verified_resolution") &&
        /PROVEN RESOLUTION ACTIONS|TROUBLESHOOTING STEPS|FINAL SOLUTION/i.test(c.content)
    );
    const verifiedStaffChunk = actionChunk || ragChunks.find(
      (c) => c.title.toLowerCase().startsWith("resolved:") || c.metadata?.source === "staff_verified_resolution"
    );

    if (verifiedStaffChunk) {
      state.source_id = verifiedStaffChunk.title;
      let actionDetails = verifiedStaffChunk.content;
      const actionsMatch = verifiedStaffChunk.content.match(
        /PROVEN RESOLUTION ACTIONS:\s*([\s\S]+?)(?=\n\n(?:RESOLUTION SUMMARY|SUMMARY|$))/i
      );
      if (actionsMatch && actionsMatch[1]) {
        actionDetails = actionsMatch[1].trim();
      }

      state.assistant_reply =
        `Step ${currentStep}: Based on our verified technician resolution (**${verifiedStaffChunk.title}**), here is the proven solution:\n\n` +
        `${actionDetails}\n\n` +
        `Could you try this procedure and let me know if it resolves the issue?`;
      return { replyText: state.assistant_reply, state };
    }

    // -------------------------------------------------------------------------
    // CASE 7: Category-Grounded Troubleshooting Steps (1 through 5)
    // -------------------------------------------------------------------------
    const categoryList = categoryProcedures[analysis.category] || categoryProcedures.other;
    const stepText = categoryList[currentStep - 1] || categoryList[categoryList.length - 1];

    state.source_id = `Step ${currentStep}`;
    state.assistant_reply = stepText;

    return { replyText: state.assistant_reply, state };
  }
}
