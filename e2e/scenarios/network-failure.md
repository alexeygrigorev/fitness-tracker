# Network Failure Scenario

## Login recovers after a dropped connection

**Given**: a returning user is on the login page
**When**: the authentication request fails before reaching the server
**Then**: the login form shows an accessible error
**And**: the user remains on the login page without receiving an auth token
**When**: connectivity is restored and the user retries
**Then**: the login succeeds and the application stores an auth token
