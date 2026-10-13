-- « Ce bac dort » (13/10/2026) : « Laisser dormir » cache la carte jusqu'à cette date.
alter table bacs add column if not exists asleep_ok_until timestamptz;
