-- Normalize Google Meet URLs by removing redundant '/meet/' path prefix
-- Keeps valid meet links intact, preserves query parameters, and ignores other meeting providers

UPDATE courses
SET google_meet_url = regexp_replace(google_meet_url, '^https?://meet\.google\.com/meet/([a-zA-Z]{3}-[a-zA-Z]{4}-[a-zA-Z]{3}(\?.*)?)$', 'https://meet.google.com/\1', 'i')
WHERE google_meet_url IS NOT NULL
  AND google_meet_url ~* '^https?://meet\.google\.com/meet/[a-zA-Z]{3}-[a-zA-Z]{4}-[a-zA-Z]{3}';

UPDATE schedules
SET meet_link = regexp_replace(meet_link, '^https?://meet\.google\.com/meet/([a-zA-Z]{3}-[a-zA-Z]{4}-[a-zA-Z]{3}(\?.*)?)$', 'https://meet.google.com/\1', 'i')
WHERE meet_link IS NOT NULL
  AND meet_link ~* '^https?://meet\.google\.com/meet/[a-zA-Z]{3}-[a-zA-Z]{4}-[a-zA-Z]{3}';
