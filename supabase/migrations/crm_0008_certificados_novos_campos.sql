-- Nova versão do app: aba Certificados ganhou 4 campos (tabela vazia -> aditivo/seguro).
alter table crm.certificados
  add column if not exists tipo_projeto text,
  add column if not exists status text,
  add column if not exists prazo date,
  add column if not exists observacoes text;
notify pgrst,'reload schema';
