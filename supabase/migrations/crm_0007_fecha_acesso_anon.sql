-- Fecha o acesso direto às tabelas crm.* (RLS ativo, sem política = nega tudo);
-- o app acessa só pelo gateway (login/crm_fetch/crm_save, que rodam como dono).
do $$ declare t text; begin
  foreach t in array array['clientes','comercial','relacionamento','rnc','demandas','agenda','historico','onb',
    'oportunidades','certificados','rentabilidade','parceiros','reajustes','historico_honorario','historico_status','controle_pessoal'] loop
    execute format('drop policy if exists crm_all on crm.%I;', t);
    execute format('revoke all on crm.%I from anon;', t);
  end loop; end $$;
notify pgrst,'reload schema';
