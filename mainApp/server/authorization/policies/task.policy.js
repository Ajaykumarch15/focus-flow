// authorization/policies/task.policy.js — personal task authorization.
//
// With only Personal and WorkLog workspaces, every task is owned by one user.
// Tasks are private: the owner may view/create/edit/delete/reopen/submit them;
// assignment and review permissions do not exist.

const { TASK } = require('../permissions');
const { isResourceOwner } = require('../relationships');

function can(user, permission, context) {
  if (!user || !context) return false;
  const task = context.resource || context.task;
  if (!task || !isResourceOwner(user, task)) return false;

  switch (permission) {
    case TASK.VIEW:
    case TASK.CREATE:
    case TASK.EDIT:
    case TASK.DELETE:
    case TASK.SUBMIT:
    case TASK.REOPEN:
      return true;
    default:
      return false;
  }
}

module.exports = { can };
