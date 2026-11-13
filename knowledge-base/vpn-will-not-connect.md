# VPN will not connect

**Category:** VPN  
**Target:** Corporate VPN clients (GlobalProtect, AnyConnect, OpenVPN)

## Problem
The corporate VPN fails to connect or drops repeatedly.

## Troubleshooting Steps
1. **Confirm baseline internet:** Ensure the device has working internet access without VPN.
   - *Expected:* General web browsing works without VPN.
2. **Re-authenticate:** Sign out and back into the VPN client, re-entering credentials and MFA code.
   - *Expected:* Authentication succeeds.
3. **Switch server/region:** Choose an alternate VPN gateway if available.
   - *Expected:* Connection establishes on an alternate server.
4. **Restart client and device:** Restart the VPN client software and reboot computer.
   - *Expected:* Clean client session connects successfully.

## Expected Result
The VPN connects and internal corporate resources are reachable.

## Escalation Conditions
Correct credentials still fail, VPN gateway appears down, or many users cannot connect.
