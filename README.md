# Biblioteca Digital — Frontend

Frontend responsivo em HTML, CSS e JavaScript puro para a API de livros em Express + Cloudflare Workers + D1.

## Arquivos

- `index.html` — estrutura das páginas e modais.
- `style.css` — identidade visual responsiva.
- `app.js` — integração com a API e interações.

## Funcionalidades

- Painel com total de livros, autores e registros com ano informado.
- Catálogo com busca por título, autor, código ou ano.
- Cadastro, edição e exclusão de livros.
- Confirmação antes de excluir.
- Estado de conexão e mensagens de sucesso/erro.
- URL da API configurável na interface.
- Layout adaptado para celular, tablet e desktop.

## Executar no VS Code

1. Extraia a pasta `biblioteca-digital`.
2. Abra a pasta no VS Code.
3. Inicie um servidor estático (recomendado: extensão **Live Server**).
4. Abra a página pelo endereço local fornecido pelo Live Server.

Também é possível publicar os arquivos estáticos diretamente no Cloudflare Pages.

## URL da API

O frontend vem configurado com a URL usada anteriormente no projeto:

`https://aula-deploy.agenilsonsales392019.workers.dev`

Para mudar, abra **Configurações da API** no menu lateral. Informe somente a URL base do Worker, sem `/api/livros`.

## Importante: CORS no backend

Como o frontend no Cloudflare Pages e a API no Workers normalmente ficam em origens diferentes, o backend precisa permitir CORS para o domínio do frontend. Sem isso, o navegador bloqueia as chamadas mesmo que a API funcione ao abrir o endpoint diretamente.

No backend, instale `cors` e configure a origem do seu site antes das rotas:

```bash
npm install cors
```

Exemplo de configuração (troque a origem pelo domínio real do seu Pages):

```js
import cors from "cors";

app.use(cors({
  origin: [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "https://SEU-PROJETO.pages.dev"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());
```

Se preferir, durante o desenvolvimento você pode usar `origin: true`, mas para publicar é melhor limitar às origens conhecidas. Depois de alterar o backend, publique novamente o Worker.

## Formato esperado da API

`GET /api/livros` deve retornar um array JSON com objetos semelhantes a:

```json
[
  { "id": 1, "titulo": "O Pequeno Príncipe", "autor": "Antoine de Saint-Exupéry", "ano": 1943 }
]
```

O frontend utiliza os endpoints existentes:

- `GET /api/livros`
- `GET /api/livros/:id`
- `POST /api/livros`
- `PUT /api/livros/:id`
- `DELETE /api/livros/:id`

Não é necessário alterar o esquema da tabela para usar a interface.

## Observações

- A fonte Manrope/DM Sans é carregada do Google Fonts; se estiver offline, o sistema usa fontes alternativas.
- A interface não implementa login/autorização porque a API fornecida não tem autenticação. Não exponha operações de escrita publicamente sem proteger o backend, caso o acervo precise de acesso restrito.
