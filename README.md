# API-DSM-4-ESTACOES

Microsserviço de gerenciamento de **estações meteorológicas** da plataforma AgroClima 360 (Equipe Vulture — 4º DSM).

Responsável exclusivamente pelas regras de negócio de estações. Sensores, leituras, alertas e autenticação vivem em serviços separados.

| Task Jira | Entrega                         |
| --------- | ------------------------------- |
| SCRUM-359 | Estrutura base do microsserviço |
| SCRUM-360 | Endpoints CRUD de estações      |

## Stack

Node.js 22 · TypeScript · Fastify 5 · Zod 4 · PostgreSQL (`pg`) · Vitest · ESLint + Prettier

## Como rodar

```bash
cp .env.example .env     # preencha a DATABASE_URL com a URL do Neon
npm ci
npm run dev              # http://localhost:3001
```

O banco é o **Neon** (PostgreSQL gerenciado). As URLs de `development` e `test` estão na página "Banco de dados" do Confluence.

O schema é criado pelos scripts em `API-DSM-4-BANCO/setup/` — não há migrations neste repositório, porque as tabelas são compartilhadas entre os microsserviços.

> O banco de `development` é compartilhado com o time: as estações que você criar pelos endpoints são vistas por todo mundo.

## Scripts

| Comando                         | O que faz                                     |
| ------------------------------- | --------------------------------------------- |
| `npm run dev`                   | Servidor em modo watch                        |
| `npm run build`                 | Compila para `dist/`                          |
| `npm start`                     | Roda a build de produção                      |
| `npm run typecheck`             | Checagem de tipos sem emitir                  |
| `npm run lint` / `lint:fix`     | ESLint                                        |
| `npm run format` / `format:fix` | Prettier                                      |
| `npm test`                      | Testes unitários e de rota                    |
| `npm run test:coverage`         | Testes + relatório de cobertura (gate de 80%) |

## Endpoints

Prefixo: `/api/stations`

| Método   | Rota                | Descrição                                       | Respostas                  |
| -------- | ------------------- | ----------------------------------------------- | -------------------------- |
| `POST`   | `/api/stations`     | Cria estação                                    | `201`, `400`, `409`        |
| `GET`    | `/api/stations`     | Lista paginada (`page`, `limit`, `property_id`) | `200`, `400`               |
| `GET`    | `/api/stations/:id` | Busca por ID                                    | `200`, `404`               |
| `PUT`    | `/api/stations/:id` | Atualiza estação                                | `200`, `400`, `404`, `409` |
| `DELETE` | `/api/stations/:id` | Exclui estação                                  | `204`, `404`               |
| `GET`    | `/health`           | Healthcheck (usado pelo CD)                     | `200`                      |

### Corpo de criação/atualização

```json
{
  "property_id": 1,
  "mac_address": "AA:BB:CC:DD:EE:FF",
  "name": "Estação Norte",
  "latitude": -23.5,
  "longitude": -46.6
}
```

Validações aplicadas:

- `property_id` — inteiro positivo, precisa existir em `properties` (senão `409 PROPERTY_NOT_FOUND`)
- `mac_address` — formato `AA:BB:CC:DD:EE:FF` ou `AA-BB-CC-DD-EE-FF`, normalizado para maiúsculas com `:`, único (senão `409 DUPLICATE_MAC_ADDRESS`)
- `name` — 3 a 100 caracteres, com `trim`
- `latitude` — `-90..90`, aceita `null`
- `longitude` — `-180..180`, aceita `null`

### Formato da listagem

```json
{
  "data": [{ "id": 1, "...": "..." }],
  "meta": { "total_records": 25, "total_pages": 2, "current_page": 1 }
}
```

### Erros

Todos os erros seguem o mesmo envelope:

```json
{ "statusCode": 409, "code": "DUPLICATE_MAC_ADDRESS", "message": "..." }
```

| Código                  | HTTP |
| ----------------------- | ---- |
| `VALIDATION_ERROR`      | 400  |
| `STATION_NOT_FOUND`     | 404  |
| `DUPLICATE_MAC_ADDRESS` | 409  |
| `PROPERTY_NOT_FOUND`    | 409  |
| `INTERNAL_SERVER_ERROR` | 500  |

## Estrutura

```
src/
  app.ts                      # composição do Fastify e injeção do repositório
  index.ts                    # bootstrap + graceful shutdown
  config/                     # env, database (pool pg), zod
  errors/                     # ApplicationError + handler global
  shared/                     # paginação reutilizável entre módulos
  modules/stations/
    controllers/              # traduz HTTP <-> service
    errors/                   # erros de negócio do módulo
    repositories/             # interface + implementação Postgres + fake in-memory
    routes/                   # registro das rotas e wiring das dependências
    schemas/                  # validação Zod de body/query/params
    services/                 # regras de negócio (um caso de uso por arquivo)
    types/
```

## Testes

Seguem o _Guia Prático de Testes Unitários_ do time: nomenclatura `should_X_when_Y`, estrutura AAA e dublês apenas em fronteiras de I/O — o Postgres é substituído pelo fake `InMemoryStationRepository`.

```bash
npm run test:coverage
```

O gate de cobertura é 80% (linhas, funções, branches e statements). `src/index.ts`, `src/config/**` e o repositório Postgres ficam fora do cálculo — este último é validado por testes de integração com banco real.

## Observação sobre o contrato

A descrição da SCRUM-360 no Jira cita os obrigatórios "Nome, Localização e Ativo/Inativo". O contrato de API (v1.3.0) e o modelo do banco definem, para `stations`, os obrigatórios `property_id`, `mac_address` e `name`, com `latitude`/`longitude` opcionais e **sem** campo `active`. A implementação seguiu o contrato + modelo do banco. Se o campo `active` for mesmo necessário, é preciso alterar o contrato e o modelo antes.
