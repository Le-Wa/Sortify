-- Onboarding « power user » : clé Anthropic personnelle (chiffrée), l'IA de ce membre passe par son compte.
alter table members add column if not exists anthropic_key_enc text;
alter table ai_usage add column if not exists own_key boolean not null default false;
