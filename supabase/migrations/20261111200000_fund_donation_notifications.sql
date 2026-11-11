-- F9: fund admins get a notification when someone donates to the fund.
alter table public.notifications drop constraint if exists notifications_reason_check;
alter table public.notifications add constraint notifications_reason_check check (reason in (
  -- comments (lib/comments)
  'reply_to_you', 'mention', 'comment_on_your_project', 'comment_on_your_profile',
  'progress_update', 'final_report', 'followed_project_comment', 'moderated_your_comment',
  -- projects you follow (not comments)
  'followed_project_active', 'followed_project_closed',
  -- money to you
  'donation_to_your_project', 'donation_to_your_budget', 'donation_to_your_fund', 'tip_on_your_comment',
  'new_offer', 'grant_to_you', 'trade_accepted',
  -- money you gave
  'offered_project_active', 'offered_project_closed',
  -- your projects
  'project_verdict', 'project_active', 'project_not_funded', 'agreement_reminder', 'update_due',
  'project_flagged', 'auction_resolved',
  -- your account and money: records
  'deposit_receipt', 'payment_received', 'withdrawal_update', 'cash_to_charity', 'agreement_record',
  -- your account and money: reminders
  'unfinished_withdrawal', 'idle_balance',
  -- people and searches you follow
  'followed_person_project', 'followed_person_comment', 'followed_person_donation', 'saved_search_match'));
