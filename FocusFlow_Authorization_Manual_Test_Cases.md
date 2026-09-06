**FocusFlow Authorization  
Manual Test Case Document**

_Workspace • Projects • Teams • Tasks • WorkLog • Collaboration_

| Document purpose     | Manual verification of FocusFlow authorization after the 9-phase authorization migration |
| -------------------- | ---------------------------------------------------------------------------------------- |
| Test environment     | Authorization Test Workspace A / Authorization Test Workspace B                          |
| Primary roles        | Owner, Admin, Member                                                                     |
| Scoped relationships | Project Manager, Project Member, Team Leader, Team Member, Task Assignee, Reviewer       |

# 1\. How to Use This Document

- Execute the test cases manually using the seeded authorization users.
- Record the actual result and mark the status as PASS or FAIL.
- For every important authorization decision, capture a screenshot of the UI state. For API/security tests, also capture the request/response from DevTools → Network when applicable.
- Do not perform destructive actions such as deleting the test workspace unless the test explicitly says to use a safe disposable record.
- If a test fails, do not immediately change the code. Record the failure, screenshot, user, resource, request, and observed behavior first.
- A hidden/disabled button is not sufficient proof of authorization. Where possible, verify the backend rejects unauthorized direct requests as well.

# 2\. Seeded Test Users

| User         | Workspace Role | Workspace   | Scoped Relationship                        |
| ------------ | -------------- | ----------- | ------------------------------------------ |
| ff-owner-01  | Owner          | Workspace A | Primary owner testing                      |
| ff-owner-02  | Owner          | Workspace B | Cross-workspace owner isolation            |
| ff-admin-01  | Admin          | Workspace A | Primary admin testing                      |
| ff-admin-02  | Admin          | Workspace B | Second workspace admin                     |
| ff-member-01 | Member         | Workspace A | Project Alpha / Team Alpha                 |
| ff-member-02 | Member         | Workspace A | Project Alpha / Team Alpha / task assignee |
| ff-member-03 | Member         | Workspace A | Project Beta / Team Beta                   |
| ff-member-04 | Member         | Workspace B | Cross-workspace isolation                  |
| ff-pm-01     | Member         | Workspace A | Project Alpha Manager                      |
| ff-pm-02     | Member         | Workspace A | Project Beta Manager                       |
| ff-tl-01     | Member         | Workspace A | Team Alpha Leader                          |
| ff-tl-02     | Member         | Workspace A | Team Beta Leader                           |

# 3\. Test Data Map

- Workspace A contains Project Alpha and Project Beta.
- Project Alpha → PM: ff-pm-01; members: ff-member-01, ff-member-02, ff-tl-01.
- Project Beta → PM: ff-pm-02; members: ff-member-03, ff-tl-02.
- Team Alpha → Leader: ff-tl-01; members: ff-member-01, ff-member-02.
- Team Beta → Leader: ff-tl-02; members: ff-member-03.
- Workspace B is intentionally separate and contains ff-owner-02, ff-admin-02 and ff-member-04.
- Tasks include Alpha-1 assigned to ff-member-01, Alpha-2 assigned to ff-member-02, Beta-1 assigned to ff-member-03, and Beta-2 assigned to ff-tl-02.

# 4\. Screenshot Method

Each test case contains a dedicated Screenshot / Evidence area. Paste the screenshot directly inside that area in Word. For tests with multiple screenshots, use the numbered evidence slots (Evidence 1, Evidence 2, etc.).

| Key          | Name                | Email                                                           | Password      | Platform Role | Workspace Role | Project Role    | Team Role      | Workspace   |
| ------------ | ------------------- | --------------------------------------------------------------- | ------------- | ------------- | -------------- | --------------- | -------------- | ----------- |
| ff-owner-01  | Auth Test Owner 01  | [ff-owner-01@focusflow.test](mailto:ff-owner-01@focusflow.test) | AuthTest2026! | user          | Owner          |                 |                | Workspace A |
| ff-owner-02  | Auth Test Owner 02  | <ff-owner-02@focusflow.test>                                    | AuthTest2026! | user          | Owner          |                 |                | Workspace B |
| ff-admin-01  | Auth Test Admin 01  | <ff-admin-01@focusflow.test>                                    | AuthTest2026! | user          | Admin          |                 |                | Workspace A |
| ff-admin-02  | Auth Test Admin 02  | <ff-admin-02@focusflow.test>                                    | AuthTest2026! | user          | Admin          |                 |                | Workspace B |
| ff-member-01 | Auth Test Member 01 | <ff-member-01@focusflow.test>                                   | AuthTest2026! | user          | Member         | Member (Alpha)  | Member (Alpha) | Workspace A |
| ff-member-02 | Auth Test Member 02 | <ff-member-02@focusflow.test>                                   | AuthTest2026! | user          | Member         | Member (Alpha)  | Member (Alpha) | Workspace A |
| ff-member-03 | Auth Test Member 03 | <ff-member-03@focusflow.test>                                   | AuthTest2026! | user          | Member         | Member (Beta)   | Member (Beta)  | Workspace A |
| ff-member-04 | Auth Test Member 04 | <ff-member-04@focusflow.test>                                   | AuthTest2026! | user          | Member         |                 |                | Workspace B |
| ff-pm-01     | Auth Test PM 01     | <ff-pm-01@focusflow.test>                                       | AuthTest2026! | user          | Member         | Manager (Alpha) |                | Workspace A |
| ff-pm-02     | Auth Test PM 02     | <ff-pm-02@focusflow.test>                                       | AuthTest2026! | user          | Member         | Manager (Beta)  |                | Workspace A |
| ff-tl-01     | Auth Test TL 01     | <ff-tl-01@focusflow.test>                                       | AuthTest2026! | user          | Member         | Member (Alpha)  | Leader (Alpha) | Workspace A |
| ff-tl-02     | Auth Test TL 02     | <ff-tl-02@focusflow.test>                                       | AuthTest2026! | user          | Member         | Member (Beta)   | Leader (Beta)  | Workspace A |

# 5\. Manual Authorization Test Cases

Run these cases in order. The sequence moves from broad workspace permissions into scoped project/team/task permissions, then WorkLog and collaboration, and finally direct API/security checks.

## 5.1 Workspace Authorization

## AUTH-WS-001 — Owner can access Workspace A

| Objective       | Verify basic owner access.                                                     |
| --------------- | ------------------------------------------------------------------------------ |
| Test User       | ff-owner-01                                                                    |
| Preconditions   | User is logged in and is Owner of Workspace A.                                 |
| Expected Result | All workspace resources load successfully and no authorization error is shown. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                                        |

### Steps

1\. Open Workspace A from the workspace switcher.

2\. Open the workspace home/dashboard.

3\. Open the member list.

4\. Open the project list.

5\. Open the team list.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-WS-002 — Owner can access workspace settings

| Objective       | Verify Owner settings access.                                                      |
| --------------- | ---------------------------------------------------------------------------------- |
| Test User       | ff-owner-01                                                                        |
| Preconditions   | User is Owner of Workspace A.                                                      |
| Expected Result | Owner can view and edit permitted workspace settings and sees owner-only controls. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                                            |

### Steps

1\. Open Workspace Settings.

2\. Verify settings controls are visible.

3\. Open the member-management section.

4\. Verify owner-level controls are present without executing destructive actions.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-WS-003 — Admin can manage workspace members

| Objective       | Verify Admin member-management authority.                      |
| --------------- | -------------------------------------------------------------- |
| Test User       | ff-admin-01                                                    |
| Preconditions   | User is Admin in Workspace A.                                  |
| Expected Result | Admin can manage Member/Admin assignments according to policy. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                        |

### Steps

1\. Open Workspace A.

2\. Open Members.

3\. Attempt a safe role change on a test Member, or open the role control if a non-destructive verification is sufficient.

4\. Verify the UI permits the operation.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-WS-004 — Admin cannot perform Owner-only actions

| Objective       | Verify Owner boundary.                                   |
| --------------- | -------------------------------------------------------- |
| Test User       | ff-admin-01                                              |
| Preconditions   | User is Admin in Workspace A.                            |
| Expected Result | Owner-only actions are unavailable or rejected with 403. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                  |

### Steps

1\. Open workspace settings.

2\. Locate ownership transfer and workspace deletion controls.

3\. Do not execute either action.

4\. If the UI exposes a direct action, attempt it only against a disposable resource or verify via a safe API request.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-WS-005 — Member can view workspace

| Objective       | Verify normal workspace access.                                |
| --------------- | -------------------------------------------------------------- |
| Test User       | ff-member-01                                                   |
| Preconditions   | User is Member of Workspace A.                                 |
| Expected Result | Member can access the workspace and permitted read-only views. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                        |

### Steps

1\. Open Workspace A.

2\. Open workspace home.

3\. Open members, projects and teams where viewing is allowed.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-WS-006 — Member cannot manage workspace members

| Objective       | Verify Member management boundary.                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| Test User       | ff-member-01                                                                                                    |
| Preconditions   | User is Member of Workspace A.                                                                                  |
| Expected Result | Member cannot change roles, add/remove members, or otherwise manage membership. Direct API attempt returns 403. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                                                                         |

### Steps

1\. Open Members.

2\. Check for role-management controls.

3\. If an API action is available, attempt a role update through DevTools.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-WS-007 — Member cannot edit workspace settings

| Objective       | Verify settings boundary.                                 |
| --------------- | --------------------------------------------------------- |
| Test User       | ff-member-01                                              |
| Preconditions   | User is Member of Workspace A.                            |
| Expected Result | Settings are unavailable/disabled or backend returns 403. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                   |

### Steps

1\. Navigate directly to Workspace Settings.

2\. Attempt to edit a setting.

3\. If possible, submit the request through the UI.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-WS-008 — Workspace A user cannot access Workspace B resources

| Objective       | Verify cross-workspace isolation.                                                             |
| --------------- | --------------------------------------------------------------------------------------------- |
| Test User       | ff-member-01                                                                                  |
| Preconditions   | User belongs only to Workspace A.                                                             |
| Expected Result | Access is denied; backend returns 403/404 according to the application's security convention. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                                                       |

### Steps

1\. Attempt to open Workspace B using its URL/ID.

2\. Attempt to open a Workspace B project/task if an ID is known.

3\. Observe UI and network response.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## 5.2 Project Authorization

## AUTH-PRJ-001 — Project Manager can manage assigned project

| Objective       | Verify PM-scoped authority.                                           |
| --------------- | --------------------------------------------------------------------- |
| Test User       | ff-pm-01                                                              |
| Preconditions   | ff-pm-01 is Member of Workspace A and PM of Project Alpha.            |
| Expected Result | Project Manager can edit Project Alpha within the permitted PM scope. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                               |

### Steps

1\. Open Project Alpha.

2\. Open project settings/info.

3\. Edit a safe project field such as description.

4\. Save the change.

5\. Verify the change persists.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-PRJ-002 — Project Manager cannot manage another project

| Objective       | Verify project isolation.                                              |
| --------------- | ---------------------------------------------------------------------- |
| Test User       | ff-pm-01                                                               |
| Preconditions   | ff-pm-01 manages Project Alpha but not Project Beta.                   |
| Expected Result | Access/edit is denied for Project Beta where PM authority is required. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                                |

### Steps

1\. Open Project Beta using navigation or direct URL.

2\. Attempt to edit project metadata.

3\. If possible, attempt the PATCH request directly.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-PRJ-003 — Project Member can access assigned project

| Objective       | Verify project-member access.                                |
| --------------- | ------------------------------------------------------------ |
| Test User       | ff-member-01                                                 |
| Preconditions   | ff-member-01 belongs to Project Alpha.                       |
| Expected Result | Project Member can access permitted Project Alpha resources. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                      |

### Steps

1\. Open Project Alpha.

2\. View project information.

3\. Open permitted project task/team views.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-PRJ-004 — Non-member cannot access project-scoped data

| Objective       | Verify project membership boundary.                  |
| --------------- | ---------------------------------------------------- |
| Test User       | ff-member-03                                         |
| Preconditions   | ff-member-03 is a member of Project Beta, not Alpha. |
| Expected Result | Unauthorized project-scoped resources are denied.    |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                              |

### Steps

1\. Attempt to open Project Alpha directly.

2\. Attempt to view an Alpha task.

3\. Observe UI and API response.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-PRJ-005 — Workspace Admin can manage projects

| Objective       | Verify Admin override within workspace.                 |
| --------------- | ------------------------------------------------------- |
| Test User       | ff-admin-01                                             |
| Preconditions   | User is Admin of Workspace A.                           |
| Expected Result | Workspace Admin can manage projects within Workspace A. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                 |

### Steps

1\. Open Project Alpha.

2\. Open project settings.

3\. Perform a safe edit.

4\. Save and verify.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-PRJ-006 — Project Manager cannot manage project membership if restricted to workspace admins

| Objective       | Verify separation between project editing and membership administration.                         |
| --------------- | ------------------------------------------------------------------------------------------------ |
| Test User       | ff-pm-01                                                                                         |
| Preconditions   | ff-pm-01 manages Project Alpha.                                                                  |
| Expected Result | Action is denied if policy reserves project membership administration for Workspace Owner/Admin. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                                                          |

### Steps

1\. Open Project Alpha member management.

2\. Attempt to add/remove a project member.

3\. Observe UI/API result.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## 5.3 Team Authorization

## AUTH-TM-001 — Team Leader can manage own team

| Objective       | Verify Team Leader scoped authority.                             |
| --------------- | ---------------------------------------------------------------- |
| Test User       | ff-tl-01                                                         |
| Preconditions   | ff-tl-01 leads Team Alpha.                                       |
| Expected Result | Team Leader can manage Team Alpha within the defined team scope. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                          |

### Steps

1\. Open Team Alpha.

2\. Edit a safe team field such as description.

3\. Open team member management.

4\. Perform a safe member-management action if available.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-TM-002 — Team Leader cannot manage another team

| Objective       | Verify cross-team isolation.                              |
| --------------- | --------------------------------------------------------- |
| Test User       | ff-tl-01                                                  |
| Preconditions   | ff-tl-01 leads Team Alpha and is not Leader of Team Beta. |
| Expected Result | Team Beta management is denied.                           |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                   |

### Steps

1\. Open Team Beta.

2\. Attempt to edit team information.

3\. Attempt member management.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-TM-003 — Team Member can view own team

| Objective       | Verify normal team access.                    |
| --------------- | --------------------------------------------- |
| Test User       | ff-member-01                                  |
| Preconditions   | User is a member of Team Alpha.               |
| Expected Result | Team details are visible according to policy. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                       |

### Steps

1\. Open Team Alpha.

2\. View team details and members.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-TM-004 — Non-team user cannot perform team-leader actions

| Objective       | Verify leader boundary.                    |
| --------------- | ------------------------------------------ |
| Test User       | ff-member-03                               |
| Preconditions   | User is not a member/leader of Team Alpha. |
| Expected Result | Team management is denied.                 |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                    |

### Steps

1\. Open Team Alpha if visible.

2\. Attempt a team management action.

3\. Observe response.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-TM-005 — Workspace Admin can manage teams

| Objective       | Verify Admin team authority.           |
| --------------- | -------------------------------------- |
| Test User       | ff-admin-01                            |
| Preconditions   | User is Admin of Workspace A.          |
| Expected Result | Admin can manage teams in Workspace A. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                |

### Steps

1\. Open Team Alpha.

2\. Edit a safe field.

3\. Verify member-management controls are available.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## 5.4 Task Authorization

## AUTH-TASK-001 — Assignee can update assigned task

| Objective       | Verify task assignee permissions.                             |
| --------------- | ------------------------------------------------------------- |
| Test User       | ff-member-01                                                  |
| Preconditions   | ff-member-01 is assigned Task Alpha-1.                        |
| Expected Result | Assignee can update only fields permitted by the task policy. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                       |

### Steps

1\. Open Task Alpha-1.

2\. Change a permitted field such as status.

3\. Save.

4\. Refresh and verify the change.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-TASK-002 — Assignee cannot change protected task ownership

| Objective       | Verify field-level authorization.                                                               |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Test User       | ff-member-01                                                                                    |
| Preconditions   | ff-member-01 is assigned Task Alpha-1.                                                          |
| Expected Result | Protected fields are rejected or ignored for an assignee; unauthorized API request returns 403. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                                                         |

### Steps

1\. Open Task Alpha-1.

2\. Attempt to change project/team/ownership fields if exposed.

3\. If possible, send a direct PATCH containing a protected field.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-TASK-003 — Project Manager can manage project tasks

| Objective       | Verify PM task authority.                                                               |
| --------------- | --------------------------------------------------------------------------------------- |
| Test User       | ff-pm-01                                                                                |
| Preconditions   | ff-pm-01 manages Project Alpha.                                                         |
| Expected Result | Project Manager can perform the task operations allowed by policy within Project Alpha. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                                                 |

### Steps

1\. Open Task Alpha-1.

2\. Edit a permitted task field.

3\. Attempt assignment/reviewer update if policy allows.

4\. Save.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-TASK-004 — Unrelated project user cannot edit task

| Objective       | Verify cross-project task isolation.                                 |
| --------------- | -------------------------------------------------------------------- |
| Test User       | ff-member-03                                                         |
| Preconditions   | User belongs to Project Beta, not Project Alpha.                     |
| Expected Result | Task access/edit is denied where user has no permitted relationship. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                              |

### Steps

1\. Open Task Alpha-1 directly.

2\. Attempt to change status or description.

3\. Observe response.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-TASK-005 — Workspace Admin can manage workspace tasks

| Objective       | Verify Admin task authority.                   |
| --------------- | ---------------------------------------------- |
| Test User       | ff-admin-01                                    |
| Preconditions   | User is Admin of Workspace A.                  |
| Expected Result | Admin can manage the task according to policy. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                        |

### Steps

1\. Open a task in Workspace A.

2\. Perform a safe task edit.

3\. Verify persistence.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-TASK-006 — Task assignment respects project/team boundaries

| Objective       | Verify assignment does not bypass scope. |
| --------------- | ---------------------------------------- |
| Test User       | ff-member-01                             |
| Preconditions   | User is a Project Alpha member.          |
| Expected Result | Invalid assignment is rejected.          |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                  |

### Steps

1\. Attempt to assign Task Alpha-1 to a user who is not an eligible project/workspace member, if UI/API supports this.

2\. Observe validation.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## 5.5 WorkLog Authorization

## AUTH-WL-001 — User can create own WorkLog

| Objective       | Verify basic WorkLog creation.                                |
| --------------- | ------------------------------------------------------------- |
| Test User       | ff-member-01                                                  |
| Preconditions   | User has access to a workspace task.                          |
| Expected Result | WorkLog is created successfully for the authorized user/task. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                       |

### Steps

1\. Open WorkLog.

2\. Create a WorkLog linked to an allowed task.

3\. Save it.

4\. Verify it appears in the user's WorkLog.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-WL-002 — User can edit own WorkLog

| Objective       | Verify ownership.              |
| --------------- | ------------------------------ |
| Test User       | ff-member-01                   |
| Preconditions   | User owns an existing WorkLog. |
| Expected Result | Own WorkLog can be edited.     |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED        |

### Steps

1\. Open the WorkLog.

2\. Edit a safe field.

3\. Save.

4\. Refresh.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-WL-003 — User cannot edit another user's WorkLog

| Objective       | Verify WorkLog ownership boundary.                           |
| --------------- | ------------------------------------------------------------ |
| Test User       | ff-member-02                                                 |
| Preconditions   | A WorkLog owned by ff-member-01 is available in Workspace A. |
| Expected Result | Unauthorized edit is rejected.                               |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                      |

### Steps

1\. Open the other user's WorkLog if visible through an authorized team/project view.

2\. Attempt to edit it.

3\. If possible, attempt direct PATCH.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-WL-004 — Team Leader can view team WorkLogs

| Objective       | Verify team-scoped visibility.                |
| --------------- | --------------------------------------------- |
| Test User       | ff-tl-01                                      |
| Preconditions   | ff-tl-01 leads Team Alpha.                    |
| Expected Result | Team Leader can view permitted team WorkLogs. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                       |

### Steps

1\. Open Team Alpha WorkLog view.

2\. Review worklogs belonging to Team Alpha members.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-WL-005 — Project Manager can view project WorkLogs

| Objective       | Verify project-scoped visibility.                    |
| --------------- | ---------------------------------------------------- |
| Test User       | ff-pm-01                                             |
| Preconditions   | ff-pm-01 manages Project Alpha.                      |
| Expected Result | Project Manager can view permitted project WorkLogs. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                              |

### Steps

1\. Open Project Alpha WorkLog view.

2\. Review worklogs linked to Project Alpha.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-WL-006 — Member cannot view unrelated team WorkLogs

| Objective       | Verify WorkLog isolation.                                            |
| --------------- | -------------------------------------------------------------------- |
| Test User       | ff-member-03                                                         |
| Preconditions   | User belongs to Project/Team Beta and is not a leader of Team Alpha. |
| Expected Result | Access is denied.                                                    |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                              |

### Steps

1\. Attempt to open Team Alpha WorkLogs.

2\. Observe response.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-WL-007 — User cannot approve own WorkLog

| Objective       | Verify approval separation.   |
| --------------- | ----------------------------- |
| Test User       | ff-member-01                  |
| Preconditions   | User has a submitted WorkLog. |
| Expected Result | Self-approval is rejected.    |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED       |

### Steps

1\. Open own submitted WorkLog.

2\. Attempt to approve it.

3\. Observe result.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-WL-008 — Authorized reviewer can approve submitted WorkLog

| Objective       | Verify approval workflow.                                                            |
| --------------- | ------------------------------------------------------------------------------------ |
| Test User       | ff-tl-01                                                                             |
| Preconditions   | A Team Alpha member has a submitted WorkLog and ff-tl-01 is authorized to review it. |
| Expected Result | WorkLog changes to approved according to policy.                                     |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                                              |

### Steps

1\. Open the submitted WorkLog.

2\. Review it.

3\. Approve it.

4\. Verify status changes.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## 5.6 Collaboration Authorization

## AUTH-COL-001 — Workspace member can create discussion

| Objective       | Verify discussion creation.         |
| --------------- | ----------------------------------- |
| Test User       | ff-member-01                        |
| Preconditions   | User is a Member of Workspace A.    |
| Expected Result | Discussion is created successfully. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED             |

### Steps

1\. Open an allowed project/task collaboration area.

2\. Create a discussion.

3\. Post it.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-COL-002 — Workspace member can comment

| Objective       | Verify comment creation.                           |
| --------------- | -------------------------------------------------- |
| Test User       | ff-member-02                                       |
| Preconditions   | User has access to the target discussion/resource. |
| Expected Result | Comment is created successfully.                   |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                            |

### Steps

1\. Open an allowed discussion.

2\. Add a comment.

3\. Verify it appears.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-COL-003 — Author can delete own comment

| Objective       | Verify resource ownership.  |
| --------------- | --------------------------- |
| Test User       | ff-member-01                |
| Preconditions   | User has created a comment. |
| Expected Result | Own comment is deleted.     |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED     |

### Steps

1\. Open the comment menu.

2\. Choose delete.

3\. Confirm if prompted.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-COL-004 — Member cannot delete another user's comment

| Objective       | Verify comment ownership boundary.   |
| --------------- | ------------------------------------ |
| Test User       | ff-member-02                         |
| Preconditions   | A comment belongs to ff-member-01.   |
| Expected Result | Deletion is unavailable or rejected. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED              |

### Steps

1\. Open the comment if visible.

2\. Attempt to delete it.

3\. Observe UI/API response.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-COL-005 — Admin can moderate collaboration resources

| Objective       | Verify Admin moderation authority.                         |
| --------------- | ---------------------------------------------------------- |
| Test User       | ff-admin-01                                                |
| Preconditions   | User is Admin of Workspace A.                              |
| Expected Result | Admin can perform actions allowed by collaboration policy. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                    |

### Steps

1\. Open an allowed discussion/comment resource.

2\. Verify permitted moderation controls.

3\. Perform only a safe moderation action.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-COL-006 — Unauthorized user cannot access unrelated collaboration resource

| Objective       | Verify parent-resource authorization.                                                 |
| --------------- | ------------------------------------------------------------------------------------- |
| Test User       | ff-member-03                                                                          |
| Preconditions   | Target collaboration resource belongs to Project Alpha; user belongs to Project Beta. |
| Expected Result | Access is denied.                                                                     |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                                               |

### Steps

1\. Open the Alpha collaboration resource directly.

2\. Attempt to comment or manipulate it.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-COL-007 — Attachment deletion respects ownership/role policy

| Objective       | Verify attachment authorization.                                 |
| --------------- | ---------------------------------------------------------------- |
| Test User       | ff-member-01                                                     |
| Preconditions   | An attachment exists in an accessible collaboration resource.    |
| Expected Result | Own-resource action succeeds; unauthorized deletion is rejected. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                          |

### Steps

1\. Attempt to delete own attachment if supported.

2\. Attempt to delete another user's attachment if available.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## 5.7 Security / Direct API / IDOR Tests

## AUTH-SEC-001 — Member cannot escalate own role to Admin

| Objective       | Verify vertical privilege escalation prevention.                               |
| --------------- | ------------------------------------------------------------------------------ |
| Test User       | ff-member-01                                                                   |
| Preconditions   | User is Member of Workspace A.                                                 |
| Expected Result | Backend rejects the request with 403/validation error and role remains Member. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                                        |

### Steps

1\. Open DevTools → Network.

2\. Perform or capture the member-role update request.

3\. Attempt to change own role to Admin by modifying the request payload.

4\. Send the request.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-SEC-002 — Member cannot assign Owner role

| Objective       | Verify Owner protection.                                        |
| --------------- | --------------------------------------------------------------- |
| Test User       | ff-member-01                                                    |
| Preconditions   | User is Member of Workspace A.                                  |
| Expected Result | Backend rejects the request; no Owner role is created/assigned. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                         |

### Steps

1\. Modify a role-assignment request to use Owner.

2\. Send the request.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-SEC-003 — Project Alpha user cannot access Project Beta by changing project ID

| Objective       | Verify IDOR prevention.                                      |
| --------------- | ------------------------------------------------------------ |
| Test User       | ff-member-01                                                 |
| Preconditions   | User has access to Project Alpha but not Project Beta.       |
| Expected Result | Backend denies access; no Beta data is returned or modified. |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                      |

### Steps

1\. Open an authorized Alpha API request in DevTools.

2\. Copy the request.

3\. Replace the project ID with Project Beta ID.

4\. Send the request.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-SEC-004 — Team Alpha leader cannot access Team Beta by changing team ID

| Objective       | Verify team IDOR prevention. |
| --------------- | ---------------------------- |
| Test User       | ff-tl-01                     |
| Preconditions   | User leads Team Alpha only.  |
| Expected Result | Backend denies the request.  |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED      |

### Steps

1\. Capture an authorized Team Alpha request.

2\. Replace team ID with Team Beta ID.

3\. Send it.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-SEC-005 — Workspace A user cannot access Workspace B by changing workspace ID

| Objective       | Verify cross-workspace IDOR prevention. |
| --------------- | --------------------------------------- |
| Test User       | ff-member-01                            |
| Preconditions   | User belongs only to Workspace A.       |
| Expected Result | Backend denies access.                  |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                 |

### Steps

1\. Capture a Workspace A request.

2\. Replace workspace ID with Workspace B ID.

3\. Send it.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-SEC-006 — Project Manager cannot elevate to workspace Admin

| Objective       | Verify scoped relationship does not become role authority. |
| --------------- | ---------------------------------------------------------- |
| Test User       | ff-pm-01                                                   |
| Preconditions   | ff-pm-01 is a workspace Member and Project Alpha PM.       |
| Expected Result | Backend rejects the operation.                             |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                                    |

### Steps

1\. Attempt to access workspace member role-management endpoint.

2\. Attempt to change a user's workspace role.

3\. Observe response.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-SEC-007 — Team Leader cannot elevate to workspace Admin

| Objective       | Verify team relationship boundary.                    |
| --------------- | ----------------------------------------------------- |
| Test User       | ff-tl-01                                              |
| Preconditions   | ff-tl-01 is a workspace Member and Team Alpha Leader. |
| Expected Result | Backend rejects the operation.                        |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                               |

### Steps

1\. Attempt workspace member role-management operation.

2\. Attempt to assign Admin role.

3\. Observe response.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

## AUTH-SEC-008 — Cross-workspace user cannot access another workspace's project/task/worklog

| Objective       | Verify complete tenant isolation.         |
| --------------- | ----------------------------------------- |
| Test User       | ff-member-04                              |
| Preconditions   | ff-member-04 belongs only to Workspace B. |
| Expected Result | All unauthorized resources are denied.    |
| Status          | ☐ PASS ☐ FAIL ☐ BLOCKED                   |

### Steps

1\. Attempt to access Workspace A project.

2\. Attempt to access Workspace A task.

3\. Attempt to access Workspace A WorkLog.

4\. Observe each response.

### Evidence / Screenshots

**  
<br/>EVIDENCE 1 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 2 — PASTE SCREENSHOT HERE  
<br/>**

**  
<br/>EVIDENCE 3 — PASTE SCREENSHOT HERE  
<br/>**

### Actual Result

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

### Notes / Defect Reference

\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\_**\__

# 6\. Final Review Checklist

☐ All Owner workspace tests completed.

☐ All Admin workspace tests completed.

☐ All Member workspace tests completed.

☐ Project Manager scope verified.

☐ Project Member scope verified.

☐ Team Leader scope verified.

☐ Team Member scope verified.

☐ Task Assignee permissions verified.

☐ Task field-level restrictions verified.

☐ Personal WorkLog ownership boundary verified.

☐ Team/project WorkLog visibility verified.

☐ WorkLog approval/self-approval boundary verified.

☐ Discussion/comment/attachment authorization verified.

☐ Cross-project isolation verified.

☐ Cross-team isolation verified.

☐ Cross-workspace isolation verified.

☐ Vertical privilege escalation tested.

☐ Horizontal privilege escalation/IDOR tested.

☐ UI restrictions and backend restrictions both verified.

# 7\. Defect Log

| Defect # | Test Case | User | Resource | Expected | Actual | Screenshot / Evidence |
| -------- | --------- | ---- | -------- | -------- | ------ | --------------------- |
|          |           |      |          |          |        |                       |
|          |           |      |          |          |        |                       |
|          |           |      |          |          |        |                       |
|          |           |      |          |          |        |                       |
|          |           |      |          |          |        |                       |
|          |           |      |          |          |        |                       |
|          |           |      |          |          |        |                       |
|          |           |      |          |          |        |                       |

# 8\. Sign-off

| Tester                      |                                            |
| --------------------------- | ------------------------------------------ |
| Test Date                   |                                            |
| Total PASS / FAIL / BLOCKED |                                            |
| Final Authorization Status  | ☐ Ready ☐ Fixes Required ☐ Retest Required |