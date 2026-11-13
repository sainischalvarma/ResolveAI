import type { AiMessage, AiProvider } from "./AiProvider.js";

export class MockAiProvider implements AiProvider {
  async classifyProblem(input: string) {
    const lowered = input.toLowerCase();
    const critical = ["production", "server down", "data loss", "security incident", "outage", "entire office", "all users"].some((term) =>
      lowered.includes(term)
    );
    const high = ["urgent", "cannot work", "deadline", "ceo", "director", "crash", "frozen"].some((term) =>
      lowered.includes(term)
    );

    let category = "other";
    if (lowered.includes("wifi") || lowered.includes("wi-fi") || lowered.includes("internet") || lowered.includes("ethernet") || lowered.includes("dns")) {
      category = "network";
    } else if (lowered.includes("vpn")) {
      category = "vpn";
    } else if (lowered.includes("printer") || lowered.includes("screen") || lowered.includes("monitor") || lowered.includes("keyboard") || lowered.includes("mouse") || lowered.includes("hardware")) {
      category = "hardware";
    } else if (lowered.includes("outlook") || lowered.includes("email") || lowered.includes("teams") || lowered.includes("zoom") || lowered.includes("app")) {
      category = "software";
    } else if (lowered.includes("password") || lowered.includes("login") || lowered.includes("account") || lowered.includes("mfa") || lowered.includes("locked")) {
      category = "account";
    } else if (lowered.includes("slow") || lowered.includes("laptop") || lowered.includes("windows") || lowered.includes("mac") || lowered.includes("reboot")) {
      category = "system";
    }

    return {
      category,
      severity: critical ? "CRITICAL" : high ? "HIGH" : "MEDIUM",
      confidence: 0.9
    };
  }

  async generateResponse(messages: AiMessage[], state?: any) {
    const systemMessage = messages.find((m) => m.role === "system")?.content ?? "";
    const userMessages = messages.filter((m) => m.role === "user").map((m) => m.content);
    const lastUserMessage = userMessages[userMessages.length - 1] ?? "";
    const conversationHistoryText = userMessages.join(" \n ").toLowerCase();
    const lowered = lastUserMessage.toLowerCase();

    let currentState = state ? { ...state } : {
      status: "new",
      completed_steps: [],
      failed_steps: [],
      issue_category: "other",
      current_step: 0
    };

    // Extract any RAG procedure provided in system message
    const ragProcedures: Array<{ title: string; content: string }> = [];
    if (systemMessage.includes("APPROVED KNOWLEDGE BASE PROCEDURES")) {
      const parts = systemMessage.split(/--- PROCEDURE \d+: /);
      for (const part of parts.slice(1)) {
        const titleMatch = part.match(/^(.*?)\s*---/);
        const title = titleMatch ? titleMatch[1].trim() : "IT Procedure";
        const content = part.replace(/^.*?---\n*/, "").replace(/INSTRUCTION:.*$/s, "").trim();
        ragProcedures.push({ title, content });
      }
    }

    // Check for critical / outage conditions
    const isCritical = ["production outage", "server down", "security breach", "data loss", "entire office down"].some((t) =>
      conversationHistoryText.includes(t)
    );
    if (isCritical) {
      currentState.impact_scope = "organization_wide";
      currentState.status = "escalated";
      currentState.escalate = true;
      currentState.reason_for_escalation = "Critical incident / organization-wide outage detected.";
      currentState.assistant_reply =
        "This indicates a critical high-priority incident. I am immediately creating an emergency P1 support ticket and escalating it to our senior infrastructure operations team. A technician is being paged right now.";
      return { content: JSON.stringify(currentState), confidence: 0.99 };
    }

    // Check for explicit escalation request
    const asksForHuman = ["human", "technician", "agent", "escalate", "create ticket", "open ticket", "raise ticket", "speak to someone", "representative"].some((t) =>
      lowered.includes(t)
    );
    if (asksForHuman) {
      currentState.status = "escalated";
      currentState.escalate = true;
      currentState.reason_for_escalation = "User requested a human technician for direct assistance.";
      currentState.assistant_reply =
        "Understood. I am raising an official support ticket and escalating your case directly to our IT support technicians. I have summarized the issue and diagnostics gathered so far, and a technician will be assigned to assist you.";
      return { content: JSON.stringify(currentState), confidence: 0.95 };
    }

    // Check for solved confirmation
    const isSolved = [
      "solved", "it worked", "working now", "fixed", "thank you", "thanks", "that helped", "connected now", "resolved", "good now"
    ].some((t) => lowered.includes(t));

    if (isSolved && currentState.status === "troubleshooting") {
      currentState.status = "solved";
      currentState.solved = true;
      currentState.assistant_reply =
        "Wonderful! I'm glad that resolved the problem for you. I've recorded this successful resolution in our system to help optimize future troubleshooting. No support ticket is needed. Feel free to start a new chat if anything else comes up!";
      return { content: JSON.stringify(currentState), confidence: 0.98 };
    }

    // Check if RAG retrieved relevant knowledge from MongoDB Atlas
    if (ragProcedures.length > 0) {
      const topRag = ragProcedures[0];
      currentState.source_id = topRag.title;
      if (!currentState.completed_steps) currentState.completed_steps = [];

      // If user confirms it failed or didn't work after RAG:
      if (lowered.includes("still not working") || lowered.includes("didn't work") || lowered.includes("not working") || lowered.includes("failed")) {
        currentState.status = "escalated";
        currentState.escalate = true;
        currentState.reason_for_escalation = `Troubleshooting step from knowledge base article "${topRag.title}" failed to resolve the issue.`;
        currentState.assistant_reply =
          `I understand those steps did not resolve the issue. I have automatically generated a support ticket and escalated this to our technical support team along with the diagnostics and procedures attempted. A technician will follow up shortly.`;
        return { content: JSON.stringify(currentState), confidence: 0.95 };
      }

      // If user is asking about the problem and we have RAG knowledge:
      currentState.status = "troubleshooting";
      currentState.assistant_reply =
        `I found a verified troubleshooting procedure in our knowledge base: **${topRag.title}**.\n\n${topRag.content}\n\nPlease try these steps and let me know if this resolves your issue or if you encounter any errors!`;
      return { content: JSON.stringify(currentState), confidence: 0.96 };
    }


    // Turn 1 & 2: Natural Diagnostic Context & Follow-ups
    // -------------------------------------------------------------
    // Scenario 1: Wi-Fi issues
    if (conversationHistoryText.includes("wi-fi") || conversationHistoryText.includes("wifi")) {
      currentState.issue_category = "network";
      currentState.status = "troubleshooting";

      // If user just reported Wi-Fi problem
      if (userMessages.length === 1 || (lowered.includes("wi-fi") && !lowered.includes("network") && !lowered.includes("icon"))) {
        currentState.assistant_reply =
          "I can help you troubleshoot that. Did the Wi-Fi icon disappear completely, or can you see available networks but cannot connect to them?";
        return { content: JSON.stringify(currentState), confidence: 0.95 };
      }

      // If user answered about seeing networks
      if (lowered.includes("see the networks") || lowered.includes("can see") || lowered.includes("unable to connect") || lowered.includes("shows available")) {
        currentState.assistant_reply =
          "Got it. Let's check whether the issue is limited to this laptop. Are other devices (like a phone or colleague's computer) able to connect to the same Wi-Fi network?";
        return { content: JSON.stringify(currentState), confidence: 0.95 };
      }

      // If other devices connect
      if (lowered.includes("other devices") || lowered.includes("phone connects") || lowered.includes("yes other") || (lowered.includes("yes") && conversationHistoryText.includes("other devices"))) {
        // If RAG has a specific stored solution from a technician (like WLAN AutoConfig):
        const matchingRag = ragProcedures.find((r) => r.content.toLowerCase().includes("wlan autoconfig"));
        if (matchingRag && matchingRag.content.toLowerCase().includes("wlan autoconfig")) {
          currentState.assistant_reply =
            `Based on our knowledge base (${matchingRag.title}), here is the verified solution:\n\n1. Press **Windows Key + R**, type \`services.msc\` and press Enter.\n2. Locate the **WLAN AutoConfig** service, right-click and select **Restart**.\n3. Open Command Prompt as Administrator and run \`netsh int ip reset\`.\n4. Reconnect to the Wi-Fi network.\n\nCould you try this and let me know if you can connect now?`;
          return { content: JSON.stringify(currentState), confidence: 0.96 };
        }

        currentState.assistant_reply =
          "Thanks for confirming. Since other devices connect, the router is working properly. Let's remove any corrupted credentials on this laptop:\n\n1. Open **Wi-Fi Settings**.\n2. Select **Manage known networks**.\n3. Click on your Wi-Fi network and select **Forget**.\n4. Scan again and reconnect, re-entering your password.\n\nDid that allow you to connect?";
        return { content: JSON.stringify(currentState), confidence: 0.95 };
      }

      // If still not connecting or failed
      if (lowered.includes("still") || lowered.includes("no") || lowered.includes("did not work") || lowered.includes("didn't work") || lowered.includes("failed")) {
        currentState.failed_steps.push("Forget network and reconnect");
        if (currentState.failed_steps.length >= 2) {
          currentState.status = "escalated";
          currentState.escalate = true;
          currentState.reason_for_escalation = "Wi-Fi network connection failed after local adapter reset and credential forget.";
          currentState.assistant_reply =
            "Since standard troubleshooting steps have not restored your Wi-Fi connection, I am automatically creating an IT support ticket for you. An IT technician will investigate your network adapter hardware and wireless profile. Your ticket has been logged and you can track it under My Tickets.";
          return { content: JSON.stringify(currentState), confidence: 0.95 };
        }

        currentState.assistant_reply =
          "Let's reset the network adapter stack:\n\n1. Press **Windows Key + X** and select **Device Manager** (or Network Settings).\n2. Alternatively, open Command Prompt as Admin and run:\n   \`ipconfig /flushdns\`\n   \`netsh winsock reset\`\n3. Restart your laptop.\n\nPlease test this and let me know the result.";
        return { content: JSON.stringify(currentState), confidence: 0.95 };
      }
    }

    // Scenario 2: Slow Laptop / Performance
    if (conversationHistoryText.includes("slow") || conversationHistoryText.includes("freeze") || conversationHistoryText.includes("laptop")) {
      currentState.issue_category = "system";
      currentState.status = "troubleshooting";

      if (userMessages.length === 1) {
        currentState.assistant_reply =
          "I can help you look into that. How long has this slowness been occurring, and does it happen right when starting up or while using a specific application?";
        return { content: JSON.stringify(currentState), confidence: 0.95 };
      }

      if (lowered.includes("since") || lowered.includes("yesterday") || lowered.includes("today") || lowered.includes("startup") || lowered.includes("boot")) {
        currentState.assistant_reply =
          "Understood. Let's see if a background process is spiking CPU or memory usage:\n\n1. Press **Ctrl + Shift + Esc** to open **Task Manager**.\n2. Check the **CPU** and **Memory** columns.\n\nAre either of them sitting near 90-100%, and do you see any specific app consuming excessive resources?";
        return { content: JSON.stringify(currentState), confidence: 0.95 };
      }

      if (lowered.includes("reboot") || lowered.includes("restart") || lowered.includes("no") || lowered.includes("high")) {
        currentState.completed_steps.push("Checked Task Manager resources");
        currentState.assistant_reply =
          "Let's perform a clean reboot and clear temporary system caches:\n\n1. Save any open documents.\n2. Hold **Shift** while clicking **Restart** in Windows to trigger a full hardware refresh.\n3. Verify if disk space has at least 15% free on drive C:.\n\nDid performance improve after the reboot?";
        return { content: JSON.stringify(currentState), confidence: 0.95 };
      }
    }

    // Scenario 3: VPN Issues
    if (conversationHistoryText.includes("vpn")) {
      currentState.issue_category = "vpn";
      currentState.status = "troubleshooting";

      if (userMessages.length === 1) {
        currentState.assistant_reply =
          "I can help troubleshoot the VPN connection. Does regular internet browsing work without the VPN connected, and what exact message or error code does the VPN client display?";
        return { content: JSON.stringify(currentState), confidence: 0.95 };
      }

      if (lowered.includes("internet works") || lowered.includes("yes") || lowered.includes("timeout") || lowered.includes("handshake")) {
        currentState.assistant_reply =
          "Got it. Let's refresh your VPN session and security token:\n\n1. Sign completely out of the VPN client.\n2. In Windows, verify that your computer's date and time are synchronized automatically (clock drift can invalidate authentication tokens).\n3. Re-launch the VPN client and authenticate using your credentials.\n\nDoes the VPN tunnel establish successfully?";
        return { content: JSON.stringify(currentState), confidence: 0.95 };
      }
    }

    // Scenario 4: Account / Password Login
    if (conversationHistoryText.includes("password") || conversationHistoryText.includes("login") || conversationHistoryText.includes("account")) {
      currentState.issue_category = "account";
      currentState.status = "troubleshooting";

      if (userMessages.length === 1) {
        currentState.assistant_reply =
          "I can help with your account login. Is this issue occurring with your computer login screen, single sign-on (SSO), or a specific web portal, and does it state 'Incorrect password' or 'Account locked'?";
        return { content: JSON.stringify(currentState), confidence: 0.95 };
      }

      if (lowered.includes("locked") || lowered.includes("lockout")) {
        currentState.status = "escalated";
        currentState.escalate = true;
        currentState.reason_for_escalation = "Account locked in Active Directory. Technician required to verify identity and unlock.";
        currentState.assistant_reply =
          "Since the account is locked in the directory, security policy requires an IT administrator to verify your identity and unlock your account. I have automatically opened a support ticket for our identity team to unlock your profile.";
        return { content: JSON.stringify(currentState), confidence: 0.95 };
      }
    }

    // Scenario 5: Printer Issues
    if (conversationHistoryText.includes("printer") || conversationHistoryText.includes("printing")) {
      currentState.issue_category = "hardware";
      currentState.status = "troubleshooting";

      if (userMessages.length === 1) {
        currentState.assistant_reply =
          "Let's get your printer working. Is the printer showing as 'Offline' in Windows Settings, or are documents sitting in the print queue without printing?";
        return { content: JSON.stringify(currentState), confidence: 0.95 };
      }

      if (lowered.includes("offline") || lowered.includes("queue") || lowered.includes("stuck")) {
        currentState.assistant_reply =
          "Let's clear the Print Spooler service:\n\n1. Press **Windows Key + R**, type \`services.msc\` and hit Enter.\n2. Find **Print Spooler**, right-click and choose **Restart**.\n3. Open Printers & Scanners, click your printer, and select **Open Queue** to cancel any stuck documents.\n\nTry sending a test print page now. Does it print?";
        return { content: JSON.stringify(currentState), confidence: 0.95 };
      }
    }

    // Default intelligent conversational fallback
    currentState.status = "troubleshooting";
    currentState.assistant_reply =
      "I understand the issue. Let's work through this step by step. Could you share what operating system or device you are currently on, and if any specific error code or popup message appeared?";

    return {
      content: JSON.stringify(currentState),
      confidence: 0.92
    };
  }
}
