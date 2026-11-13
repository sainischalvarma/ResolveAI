# Outlook not sending or receiving

**Category:** Outlook / Email  
**Target:** Microsoft Outlook desktop client and Exchange/M365 accounts

## Problem
Outlook will not send or receive email, or remains stuck 'Trying to connect'.

## Troubleshooting Steps
1. **Check internet connectivity:** Verify general browsing works.
   - *Expected:* Web pages load.
2. **Confirm Online status:** Confirm Outlook is Online (under Send/Receive tab, ensure 'Work Offline' is not enabled).
   - *Expected:* Status bar displays 'Connected'.
3. **Send/Receive manual sync:** Click Send/Receive All Folders manually.
   - *Expected:* Mailbox synchronizes.
4. **Restart Outlook & computer:** Close Outlook, end lingering processes in Task Manager, and reboot.
   - *Expected:* Profile reconnects cleanly.
5. **Re-authenticate account:** Verify credentials or re-authenticate when prompted.
   - *Expected:* Mailbox authenticates successfully.

## Expected Result
Email sends and receives normally.

## Escalation Conditions
Mailbox authentication keeps failing, mailbox is full/locked, or mail server is unreachable for multiple users.
