# OpsAgents EPG Service Demo: Voice-Over Script

**Total Duration:** 4 minutes 20 seconds  
**Format:** Professional technical narration for software incident response demo

---

## SCENE 1: THE INCIDENT (0:00-0:30)

**[VISUAL]**
- Black screen with red alert banner
- Timeline: "2024-01-15 14:32:15 UTC"
- Deployment log showing BBC One EPG pipeline v2.3.1 rollout
- Error dashboard populating with red indicators

**[SPEAKER]**

"At 2:32 PM UTC, BBC One's EPG pipeline deployed version 2.3.1. Within seconds, the entire pipeline crashes. A null pointer exception is thrown on the `end_time` field—data that should never be null. The impact is immediate: the BBC One schedule for 9 PM to 11 PM goes completely blank across millions of screens."

**[SPEAKER CONTINUES]**

"The deployment also introduces a critical security vulnerability: an AWS API key is hardcoded directly in the source code. But there's no time to worry about that now. The service is down. OpsAgents is about to change everything."

---

## SCENE 2: OPSAGENTS ACTIVATES (0:30-1:15)

**[VISUAL]**
- OpsAgents logo appears with activation sound
- MetaController dashboard showing incident received
- Four colored threads launch in parallel: Red (Incident), Blue (Deployment), Green (Monitoring), Yellow (Infrastructure)
- Each controller spinning up with status indicators

**[SPEAKER]**

"When the alert hits the system, OpsAgents' MetaController receives the incident trigger and immediately orchestrates the response. All four controllers activate in parallel—Incident, Deployment, Monitoring, and Infrastructure—each coordinating a specialized task force."

**[VISUAL]**
- Expand view of IncidentController
- Seven agent icons appear in cascade sequence: Issue ID → Root Cause → Code Fix → Spare Tier → Escalation → Deployment Validation → Reporting

**[SPEAKER CONTINUES]**

"The IncidentController launches seven specialized agents in rapid sequence, each with a single critical responsibility. They operate autonomously, but in perfect synchronization. This is where OpsAgents truly excels: orchestrated parallel problem-solving at scale."

---

## SCENE 3: INVESTIGATION (1:15-2:15)

**[VISUAL]**
- Split screen showing agent execution timeline
- Left side: Console logs flowing
- Right side: Dashboard metrics updating in real-time

**[SPEAKER]**

"Agent one: Issue Identification. It scans the error logs, metrics, and traces. The culprit is clear—a null pointer exception in the EPG data processing function. Specifically, the `end_time` field is being accessed without null checks. The agent flags this as a code-level defect, not a configuration issue or missing data."

**[VISUAL]**
- Root cause analysis graph appears showing deployment correlation
- Red line connecting v2.3.1 deployment to incident timestamp

**[SPEAKER CONTINUES]**

"Agent two: Root Cause Analysis. It correlates the crash with the exact deployment time. Version 2.3.1 introduced the null pointer bug. The fix? Add a null check and provide a sensible default for any missing `end_time` values. This is not a complex problem—it's a simple defensive coding oversight."

**[VISUAL]**
- Git interface appears: branch creation, code diff showing null check addition, GitHub PR opens
- Screen shows the PR number: #4287
- Changes highlighted in green

**[SPEAKER]**

"Agent three: Code Fix. It's now autonomous. The agent creates a new branch, applies the patch—adding a null check before accessing `end_time`—and opens a pull request automatically. In traditional incident response, this step alone would require a developer to wake up, understand the problem, write code, and submit for review. OpsAgents does it in seconds."

---

## SCENE 4: REMEDIATION (2:15-3:00)

**[VISUAL]**
- Spare tier infrastructure diagram lights up
- Traffic flow diagram shows redirection from primary to spare tier
- Percentage indicator: "100% traffic rerouted"

**[SPEAKER]**

"While the fix is being validated, agent four activates immediately: Spare Tier Redundancy. It detects that a healthy spare EPG pipeline is available in standby. The agent fails over BBC One's traffic to this spare tier—restoring service instantly. Broadcast resumes. The blank 9-to-11 schedule slot is no longer a crisis; it's a solvable problem."

**[VISUAL]**
- Escalation decision tree appears
- System metrics show: Error rate: 0%, Service availability: 100%
- Agent assessment displayed: "AUTO-REMEDIATED - No human escalation required"

**[SPEAKER CONTINUES]**

"Agent five: Escalation. It evaluates whether this incident needs human intervention. Severity: High. Status: Auto-remediated by spare tier. Resolution: In progress. The agent makes the decision: no human escalation needed. The incident is contained."

**[VISUAL]**
- Deployment validation dashboard shows test results
- All health checks turning green
- Metrics: "CPU: 12%", "Memory: 34%", "Error rate: 0%", "P99 latency: 84ms"

**[SPEAKER]**

"Agent six: Deployment Controller. It continuously validates the health of the spare tier, ensuring it's handling full load without degradation. All metrics are nominal."

---

## SCENE 5: EXECUTIVE SUMMARY (3:00-3:30)

**[VISUAL]**
- ReportingAgent processing logs
- Report document building in real-time
- Timestamps, metrics, timeline, resolution details flowing in

**[SPEAKER]**

"Agent seven: Reporting. It generates a comprehensive incident report. Root cause, timeline, actions taken, impact, and resolution—all documented automatically for audit and learning."

**[VISUAL]**
- Split screen showing three outputs:
  1. Slack notification with incident summary
  2. Executive email with key metrics
  3. Dashboard update showing incident resolved

**[SPEAKER CONTINUES]**

"The ExecutiveCommunicationAgent now delivers three coordinated outputs: A Slack message to the ops team with real-time status. An executive email with the business impact and resolution timeline. And a dashboard update for stakeholders. No manual communication overhead. Everyone knows the status, simultaneously."

---

## SCENE 6: RESOLUTION & IMPACT (3:30-4:20)

**[VISUAL]**
- Timeline showing total elapsed time: "4 minutes 18 seconds"
- BBC One schedule grid showing 21:00-23:00 slot restored
- Final metrics dashboard:
  - Service availability: 100%
  - Error rate: 0%
  - Spare tier gracefully shed back to standby
  - PR #4287 merged and deployed

**[SPEAKER]**

"Total elapsed time from incident to full resolution: four minutes and eighteen seconds. The BBC One schedule is restored. All 21 million households with BBC One receive the correct program guide. The spare tier is no longer needed and gracefully returns to standby."

**[VISUAL]**
- Screen transitions through key achievements with checkmarks:
  - ✓ Service restored automatically
  - ✓ Root cause identified and fixed
  - ✓ Code changes automated
  - ✓ Zero human intervention required
  - ✓ Full audit trail generated

**[SPEAKER CONTINUES]**

"Let's be clear about what just happened: An incident that would typically require 30 minutes of human troubleshooting, code review, testing, and deployment was completely resolved in under five minutes—with zero human intervention. No incident commander. No paging the on-call developer. No manual hotfix deployment."

**[VISUAL]**
- Security vulnerability notification appears with checkmark
- Shows: "Hardcoded API key detected and flagged for remediation"

**[SPEAKER]**

"Even the security vulnerability was detected and flagged automatically. In a traditional setup, that API key might not be discovered until a security audit months later."

**[VISUAL]**
- OpsAgents logo with text overlay:
  "Orchestrated. Parallel. Autonomous. Human-oversight integrated."
- Final metric: "Cost of incident: 47 seconds of compute time"

**[SPEAKER - CLOSING]**

"This is the future of incident response. OpsAgents doesn't replace your ops team—it amplifies them. It handles the routine, the urgent, and the complex with speed and consistency. Your team focuses on strategy, architecture, and innovation. OpsAgents handles the incidents."

**[FADE TO BLACK]**

---

## PRODUCTION NOTES

**Pacing:**
- Speak at a natural, conversational pace (140-150 words per minute)
- Allow 1-2 second pauses between major scene transitions
- Emphasize numbers: "four minutes and eighteen seconds", "21 million households"

**Tone:**
- Professional but engaging
- Highlight the *speed* and *automation* as key selling points
- No hype—let the data speak

**Visual Sync Points:**
- "At 2:32 PM UTC" — show timestamp on screen
- "null pointer exception" — highlight error in logs
- Each agent name — show corresponding visual indicator
- "4 minutes 18 seconds" — display final timer
- Security vulnerability mention — show flagged alert
