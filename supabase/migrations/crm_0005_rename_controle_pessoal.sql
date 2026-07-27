-- Renomeia crm.acessos -> crm.controle_pessoal (nome igual ao da aba do app).
-- Colunas: id, owner, sistema, categoria, link, usuario(CIFRADO), senha(CIFRADA), observacoes.
alter table crm.acessos rename to controle_pessoal;
alter index crm.idx_crm_acessos_owner rename to idx_crm_controle_pessoal_owner;
notify pgrst, 'reload schema';
