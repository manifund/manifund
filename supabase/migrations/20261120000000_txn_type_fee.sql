-- Donor fee taken out of a deposit, as its own row so the deposit (and its receipt) stays the full amount
alter type public.txn_type add value if not exists 'fee';
