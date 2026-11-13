# Printer not printing

**Category:** Printer / Hardware  
**Target:** Local and networked printers

## Problem
Documents do not print, or the printer shows offline or in error state.

## Troubleshooting Steps
1. **Physical check:** Check the printer is powered on, has paper, toner/ink, and no error lights.
   - *Expected:* Printer displays Ready status.
2. **Default status:** Confirm printer is set as default and shows Online (not paused).
   - *Expected:* Status is Online.
3. **Clear print queue:** Clear the stuck print queue and resend the job.
   - *Expected:* The stuck job clears and the new document prints.
4. **Restart Print Spooler:** Restart the Print Spooler service or restart the computer.
   - *Expected:* Spooler restarts and printing resumes.
5. **Reinstall driver:** Reinstall or reconnect the printer driver.
   - *Expected:* Printer is detected and prints a test page.

## Expected Result
A test page or document prints successfully.

## Escalation Conditions
Hardware fault (paper jam that cannot be cleared, hardware error code), or shared office printer down for many users.
