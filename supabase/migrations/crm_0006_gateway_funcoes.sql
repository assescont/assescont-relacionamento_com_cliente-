-- Gateway: acesso ao CRM só por funções (SECURITY DEFINER) que exigem token de sessão.
create table if not exists crm.sessions (
  token text primary key, email text not null, nome text,
  created_at timestamptz not null default now(), expires_at timestamptz not null);
alter table crm.sessions enable row level security;  -- sem política: só as funções acessam

create or replace function crm.session_email(p_token text)
returns text language sql security definer stable set search_path=crm,public as $$
  select email from crm.sessions where token=p_token and expires_at>now(); $$;

create or replace function crm.login(p_email text, p_senha text)
returns table(token text, email text, nome text)
language plpgsql security definer set search_path=crm,public,extensions as $$
declare v_email text; v_nome text; v_tok text;
begin
  select u.email,u.nome into v_email,v_nome from crm."user" u
   where lower(u.email)=lower(p_email) and u.ativo and u.senha_hash=crypt(p_senha,u.senha_hash);
  if v_email is null then return; end if;
  v_tok := encode(gen_random_bytes(32),'hex');
  delete from crm.sessions where expires_at<now();
  insert into crm.sessions(token,email,nome,expires_at) values (v_tok,v_email,v_nome,now()+interval '12 hours');
  return query select v_tok,v_email,v_nome;
end $$;
grant execute on function crm.login(text,text) to anon, authenticated;

create or replace function crm.crm_fetch(p_token text)
returns jsonb language plpgsql security definer set search_path=crm,public as $$
declare v_email text;
begin
  v_email := crm.session_email(p_token);
  if v_email is null then raise exception 'sessao_invalida'; end if;
  return jsonb_build_object(
    'clientes',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from crm.clientes t),
    'comercial',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from crm.comercial t),
    'relacionamento',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from crm.relacionamento t),
    'rnc',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from crm.rnc t),
    'demandas',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from crm.demandas t),
    'agenda',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from crm.agenda t),
    'historico',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from crm.historico t),
    'onb',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from crm.onb t),
    'oportunidades',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from crm.oportunidades t),
    'certificados',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from crm.certificados t),
    'rentabilidade',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from crm.rentabilidade t),
    'parceiros',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from crm.parceiros t),
    'reajustes',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from crm.reajustes t),
    'historico_honorario',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from crm.historico_honorario t),
    'historico_status',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from crm.historico_status t),
    'controle_pessoal',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from crm.controle_pessoal t where t.owner=v_email));
end $$;
grant execute on function crm.crm_fetch(text) to anon, authenticated;

create or replace function crm.crm_save(p_token text, p_changes jsonb)
returns void language plpgsql security definer set search_path=crm,public as $$
declare v_email text; t text; up jsonb; del jsonb; cols text;
  allowed text[]:=array['clientes','comercial','relacionamento','rnc','demandas','agenda','historico','onb',
    'oportunidades','certificados','rentabilidade','parceiros','reajustes','historico_honorario','historico_status','controle_pessoal'];
begin
  v_email := crm.session_email(p_token);
  if v_email is null then raise exception 'sessao_invalida'; end if;
  for t in select jsonb_object_keys(p_changes) loop
    if not (t=any(allowed)) then continue; end if;
    up:=coalesce(p_changes->t->'up','[]'::jsonb); del:=coalesce(p_changes->t->'del','[]'::jsonb);
    if t='controle_pessoal' then
      up:=coalesce((select jsonb_agg(r||jsonb_build_object('owner',v_email)) from jsonb_array_elements(up) r),'[]'::jsonb);
    end if;
    if jsonb_array_length(del)>0 then
      if t='controle_pessoal' then execute format('delete from crm.%I where id in (select jsonb_array_elements_text($1)) and owner=$2',t) using del,v_email;
      else execute format('delete from crm.%I where id in (select jsonb_array_elements_text($1))',t) using del; end if;
    end if;
    if jsonb_array_length(up)>0 then
      execute format('delete from crm.%I where id in (select r->>''id'' from jsonb_array_elements($1) r)',t) using up;
      cols:=(select string_agg(distinct quote_ident(k),',') from jsonb_array_elements(up) e, jsonb_object_keys(e) k);
      execute format('insert into crm.%I (%s) select %s from jsonb_populate_recordset(null::crm.%I,$1)',t,cols,cols,t) using up;
    end if;
  end loop;
end $$;
grant execute on function crm.crm_save(text,jsonb) to anon, authenticated;
notify pgrst,'reload schema';
