# Connected to Wi-Fi but no internet

**Category:** Internet connection  
**Target:** Devices with Wi-Fi connection but no internet access

## Problem
The device is connected to the network but web pages do not load (no internet / limited connectivity).

## Troubleshooting Steps
1. **Check other devices on same network:**
   - *Expected:* Identifies if the issue is local to this device or network-wide.
2. **Power-cycle modem / router:** Unplug for 30 seconds, plug back in, wait 2 minutes.
   - *Expected:* Internet connectivity is restored.
3. **Renew IP address:** Disable and enable the network adapter.
   - *Expected:* A valid IP and default gateway are obtained.
4. **Try known site by IP / flush DNS:** Test DNS resolution and run `ipconfig /flushdns`.
   - *Expected:* Hostnames resolve and web pages load normally.

## Expected Result
Web pages load and internet access is restored.

## Escalation Conditions
No device on the network has internet (possible ISP or office outage), OR the entire office is affected.
