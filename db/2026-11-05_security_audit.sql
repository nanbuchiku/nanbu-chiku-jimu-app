-- 外から見える設定の確認（読むだけ。データは変更しない。個人情報は出ない）
select jsonb_pretty(jsonb_build_object(
  'tables', (
    select jsonb_agg(jsonb_build_object('table', c.relname, 'rls', c.relrowsecurity) order by c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  ),
  'policies', (
    select jsonb_agg(jsonb_build_object(
      'schema', schemaname, 'table', tablename, 'name', policyname,
      'cmd', cmd, 'roles', roles, 'using', qual, 'check', with_check
    ) order by schemaname, tablename, policyname)
    from pg_policies
    where schemaname = 'public' or (schemaname = 'storage' and tablename in ('objects', 'buckets'))
  ),
  'grants', (
    select jsonb_agg(jsonb_build_object('table', table_name, 'role', grantee, 'priv', privs) order by table_name, grantee)
    from (
      select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privs
      from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon', 'authenticated')
      group by table_name, grantee
    ) g
  ),
  'functions', (
    select jsonb_agg(jsonb_build_object(
      'name', p.proname, 'security_definer', p.prosecdef,
      'anon_can_run', has_function_privilege('anon', p.oid, 'EXECUTE')
    ) order by p.proname)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  ),
  'buckets', (
    select jsonb_agg(jsonb_build_object('id', id, 'public', public, 'size_limit', file_size_limit) order by id)
    from storage.buckets
  )
)) as result;
