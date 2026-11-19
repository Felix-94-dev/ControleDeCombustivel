// Preencha com os dados do seu projeto Supabase (Project Settings > API).
// A anon key é pública por design: quem protege os dados é o login + as regras RLS do schema.sql.
// Deixe em branco para rodar em modo local (localStorage, login felix / 123456).
window.SUPABASE_CONFIG={
  url:"https://ldvpoftgbbyqgqvvihkq.supabase.co",      // ex.: https://abcdxyz.supabase.co
  dominio:"frota.app",  // usuário "felix" entra como felix@frota.app (crie os usuários no Supabase com esse e-mail)
  anonKey:"sb_publishable_fpbuCO9QoxYoY5Xao7jRxQ_cIBiUP8I"   // chave "anon public" (nunca use a service_role aqui)
};
