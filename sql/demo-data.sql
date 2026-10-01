insert into public.attendance_groups (department_id,group_name,attendance,punctuality)
select d.id,v.group_name,v.attendance,v.punctuality
from public.departments d join (values
('l1-l2','L2 Software Development A',96.4,95.2),('l1-l2','L2 Cyber Security',94.8,93.9),('l1-l2','L1 Computing A',93.5,94.0),('l1-l2','L2 Computing B',92.6,91.8),('l1-l2','L1 Computing B',91.2,90.7),
('l3','L3 Cyber Security A',96.8,95.4),('l3','L3 Software Development',94.9,93.8),('l3','L3 Cyber Security B',93.7,94.1),('l3','L3 Games Development',91.4,92.2),('l3','L3 IT Support',90.8,92.3),
('games','Games Development A',97.2,95.8),('games','Games Development B',95.1,94.2),('games','Games Design',93.8,94.1),('games','Interactive Media',92.4,91.7),
('he','Computing HNC',97.1,96.0),('he','Computing HND',95.2,94.7),('he','BSc Computing',94.4,93.6),('he','BSc Cyber Security',92.7,93.1),('he','HNC Software Development',91.5,92.0)
) as v(slug,group_name,attendance,punctuality) on v.slug=d.slug
on conflict (department_id,group_name) do update set attendance=excluded.attendance,punctuality=excluded.punctuality,updated_at=now();
