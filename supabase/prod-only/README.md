# Production-only SQL for the comments rework (not applied locally)

The POC keeps the shared local database additive (other POCs still use the old paths). When the
comments rework is reimplemented for production, these changes go with it, after the code that no
longer needs the old paths is deployed. Review each before running; none is applied anywhere yet.

`comments-rework.sql`:
1. Drop the open insert policy on `comments`: writes go through the server only.
2. Drop the `comment-notifications` database webhook: `lib/comments` records and sends notifications.
3. Replace `give_grant` / `create_transfer_grant` / `execute_grant_verdict` with the `_v2` bodies
   (or keep the `_v2` names) and drop the unused overloads (`transfer_project` x3,
   `_transfer_project` 5-/7-argument versions, `execute_grant_verdict` 5-argument version,
   `reject_grant`, `add_tags`, `add_topics`): see design/comments-sql.md section 4.
4. Not done here: `comment_rxns` has the same open insert policy; its route still writes with the
   user's client.
