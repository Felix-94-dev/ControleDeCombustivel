# Frota União – Controle de combustível

Site estático (HTML/CSS/JS) com banco e login no Supabase.

## Configurar o Supabase
1. Crie o projeto em supabase.com.
2. SQL Editor > cole `supabase/schema.sql` > Run.
3. Authentication > Users > Add user (e-mail e senha de cada usuário; marque "Auto Confirm").
4. Project Settings > API: copie **Project URL** e **anon public key** para `js/config.js`.
5. Faça commit e push; o GitHub Pages republica sozinho.

## Publicar no GitHub Pages
Settings > Pages > Source: "Deploy from a branch" > `main` / `/ (root)`.

## Rodar local
`python3 -m http.server` na pasta e abra http://localhost:8000. Com `config.js` em branco roda em modo local (felix / 123456).

## Importar backup antigo
Se já tem dados no navegador: na versão antiga, Backup > Exportar. Na nova (já logado), Backup > Restaurar. Os dados vão para o banco.
