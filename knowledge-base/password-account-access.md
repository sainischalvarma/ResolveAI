# Cannot log in / password issues

**Category:** Password / Account access  
**Target:** Corporate SSO, Active Directory, and portal accounts

## Problem
The user cannot sign in, or the account is locked.

## Troubleshooting Steps
1. **Verify credentials:** Confirm username/email is correct and Caps Lock is off.
   - *Expected:* Correct credentials entered without typing errors.
2. **Verify portal domain:** Confirm using the official company portal or domain sign-in page.
   - *Expected:* Domain and sign-in page match the account.
3. **Self-service password reset:** Use self-service password reset if enabled.
   - *Expected:* Password reset completes and login succeeds.
4. **MFA verification:** Complete MFA prompt or re-register authentication app if prompted.
   - *Expected:* MFA verification passes.

## Expected Result
The user successfully signs in.

## Escalation Conditions
Account is locked and self-service reset is unavailable, or MFA cannot be recovered without technician intervention.
