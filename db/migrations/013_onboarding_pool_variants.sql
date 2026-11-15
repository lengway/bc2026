ALTER TABLE onboarding_pool
  DROP CONSTRAINT onboarding_pool_field_subfield_level_key,
  ADD UNIQUE (field,subfield,level,archetype_id);
