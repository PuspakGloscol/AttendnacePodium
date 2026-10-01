-- Replace each UUID with the Auth user UUID created in Authentication > Users.
insert into public.admin_profiles (user_id,department_id) select 'REPLACE_WITH_L1_L2_USER_UUID'::uuid,id from public.departments where slug='l1-l2' on conflict (user_id) do update set department_id=excluded.department_id;
insert into public.admin_profiles (user_id,department_id) select 'REPLACE_WITH_L3_USER_UUID'::uuid,id from public.departments where slug='l3' on conflict (user_id) do update set department_id=excluded.department_id;
insert into public.admin_profiles (user_id,department_id) select 'REPLACE_WITH_GAMES_USER_UUID'::uuid,id from public.departments where slug='games' on conflict (user_id) do update set department_id=excluded.department_id;
insert into public.admin_profiles (user_id,department_id) select 'REPLACE_WITH_HE_USER_UUID'::uuid,id from public.departments where slug='he' on conflict (user_id) do update set department_id=excluded.department_id;
