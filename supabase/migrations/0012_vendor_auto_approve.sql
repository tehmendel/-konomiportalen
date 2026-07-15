-- Lar husstanden stole på en leverandørs kategoriforslag uansett konfidens
-- (bypasser 0.5-terskelen i matchAgainstVendors), og huske avviste regelforslag.
alter table vendors add column auto_approve boolean not null default false;
alter table vendors add column rule_suggestion_dismissed boolean not null default false;
