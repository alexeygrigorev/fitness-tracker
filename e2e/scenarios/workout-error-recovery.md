# Active Workout Error Recovery Scenario

## A failed set save recovers on retry

**Given**: an athlete has started a Push Day workout and entered a dropdown set
**When**: the request to save that set fails with a server error
**Then**: Active Workout shows an accessible error
**And**: the set remains incomplete and editable
**And**: every weight and rep value entered before the failure is retained
**When**: connectivity or service availability is restored and the athlete saves again
**Then**: the same payload is submitted successfully
**And**: the error is cleared and the set is marked complete
**And**: reloading confirms the recovered save was persisted by the backend
