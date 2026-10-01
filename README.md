# Gloucestershire College Computing Attendance

## Final structure

* L1 & L2 — professional Computing design + separate L1/L2 admin login
* L3 — professional Computing design + separate L3 admin login
* Games — retro arcade design + separate Games admin login
* Higher Education — professional Computing design + separate HE admin login

All four use the same Supabase project/schema, with `admin_profiles.department_id` limiting each admin to their own department.

## Local testing

Open `l1-l2/index.html`, `l3/index.html`, or `he/index.html` directly in a browser. If `config.js` still contains placeholders, the public page uses built in demo data so the landing podium and name decoding animation can be tested without Supabase.

The Games page keeps its own retro design.

## Supabase

Each department folder has its own `config.js` using the same Supabase project URL/key, with a different `departmentSlug`:
* `l1-l2`
* `l3`
* `games`
* `he`

Use the existing SQL files to set up demo data and RLS.

## Four separate admin logins

Create four Supabase Auth users and create one matching row in `admin_profiles` for each user. Each profile must point to exactly one department. The existing RLS policies then allow each authenticated admin to insert, update and delete only groups from their own department.

Never put a service role or secret key in the website files. Use only the Supabase publishable/anon key in `config.js`.
