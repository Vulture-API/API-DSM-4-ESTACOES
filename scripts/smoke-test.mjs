// Bateria de verificação manual da API, contra um servidor já em execução.
//
//   npm run dev          (num terminal)
//   npm run smoke        (noutro)
//
// Opções:
//   npm run smoke -- --url http://localhost:3001 --property-id 2
//
// Funciona igual em Windows, Linux e macOS — diferente de uma sequência de
// curl, que muda de sintaxe conforme o shell.

const args = process.argv.slice(2);
const valorDe = (nome, padrao) => {
  const i = args.indexOf(`--${nome}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : padrao;
};

const BASE = valorDe("url", "http://localhost:3001").replace(/\/$/, "");
const PROPERTY_ID = Number(valorDe("property-id", "1"));

// Sufixo único: o banco de development é compartilhado, então dois devs
// rodando o smoke ao mesmo tempo não podem colidir no MAC (que é único).
const sufixo = Date.now().toString(16).slice(-6).toUpperCase();
const mac = (n) =>
  `A${sufixo.slice(0, 1)}:${sufixo.slice(1, 3)}:${sufixo.slice(3, 5)}:${sufixo.slice(5)}0:00:${String(n).padStart(2, "0")}`;
const NOME = `Smoke ${sufixo}`;

let passou = 0;
let falhou = 0;
const criados = [];

async function chamar(metodo, caminho, corpo) {
  const resposta = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: corpo ? { "Content-Type": "application/json" } : {},
    body: corpo ? JSON.stringify(corpo) : undefined,
  });

  const texto = await resposta.text();
  let json = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    json = texto;
  }

  return { status: resposta.status, json };
}

function verificar(descricao, condicao, detalhe) {
  if (condicao) {
    passou++;
    console.log(`  ok   ${descricao}`);
  } else {
    falhou++;
    console.log(`  FALHA ${descricao}`);
    if (detalhe !== undefined) {
      console.log(`         recebido: ${JSON.stringify(detalhe)}`);
    }
  }
}

console.log(`Smoke test em ${BASE}`);
console.log(`property_id ${PROPERTY_ID}, sufixo ${sufixo}\n`);

// --- disponibilidade -------------------------------------------------------
try {
  const saude = await chamar("GET", "/health");
  verificar("/health responde 200", saude.status === 200, saude.json);
} catch (erro) {
  console.error(`\nNão consegui falar com ${BASE}.`);
  console.error(`Suba o servidor com "npm run dev" antes de rodar o smoke.`);
  console.error(`(${erro.message})`);
  process.exit(1);
}

// --- criação ---------------------------------------------------------------
console.log("\nCriação");
const base = {
  property_id: PROPERTY_ID,
  mac_address: mac(1),
  name: NOME,
  latitude: -23.5,
  longitude: -46.6,
};

const criacao = await chamar("POST", "/api/stations", base);

if (criacao.status === 409 && criacao.json?.code === "PROPERTY_NOT_FOUND") {
  console.error(`\n  A propriedade ${PROPERTY_ID} não existe no banco.`);
  console.error(
    `  Rode "npm run db:setup" em API-DSM-4-BANCO e use um dos ids que ele listar:`,
  );
  console.error(`    npm run smoke -- --property-id <id>`);
  process.exit(1);
}

verificar("POST válido devolve 201", criacao.status === 201, criacao.json);
verificar(
  "resposta traz id numérico",
  typeof criacao.json?.id === "number",
  criacao.json?.id,
);
verificar(
  "latitude vem como número",
  typeof criacao.json?.latitude === "number",
  criacao.json?.latitude,
);
verificar(
  "last_communication_at começa nulo",
  criacao.json?.last_communication_at === null,
);
verificar("created_at preenchido", Boolean(criacao.json?.created_at));

const id = criacao.json?.id;
if (id) criados.push(id);

const normalizacao = await chamar("POST", "/api/stations", {
  ...base,
  mac_address: mac(2).toLowerCase().replaceAll(":", "-"),
  name: `${NOME} normalizado`,
});
verificar(
  "MAC minúsculo com hífen é aceito",
  normalizacao.status === 201,
  normalizacao.json,
);
verificar(
  "MAC volta maiúsculo com dois-pontos",
  normalizacao.json?.mac_address === mac(2),
  normalizacao.json?.mac_address,
);
if (normalizacao.json?.id) criados.push(normalizacao.json.id);

// --- validação -------------------------------------------------------------
console.log("\nValidação");
const macInvalido = await chamar("POST", "/api/stations", {
  ...base,
  mac_address: "nao-e-mac",
});
verificar(
  "MAC inválido devolve 400",
  macInvalido.status === 400,
  macInvalido.status,
);

const latitudeInvalida = await chamar("POST", "/api/stations", {
  ...base,
  mac_address: mac(3),
  latitude: 120,
});
verificar(
  "latitude fora de -90..90 devolve 400",
  latitudeInvalida.status === 400,
  latitudeInvalida.status,
);

const nomeCurto = await chamar("POST", "/api/stations", {
  ...base,
  mac_address: mac(4),
  name: "AB",
});
verificar(
  "nome com menos de 3 caracteres devolve 400",
  nomeCurto.status === 400,
  nomeCurto.status,
);

const semCampos = await chamar("POST", "/api/stations", { name: "Só o nome" });
verificar(
  "corpo incompleto devolve 400",
  semCampos.status === 400,
  semCampos.status,
);

const idNaoNumerico = await chamar("GET", "/api/stations/abc");
verificar(
  "id não numérico devolve 400",
  idNaoNumerico.status === 400,
  idNaoNumerico.status,
);

// --- conflitos -------------------------------------------------------------
console.log("\nConflitos");
const duplicado = await chamar("POST", "/api/stations", {
  ...base,
  name: `${NOME} duplicado`,
});
verificar(
  "MAC duplicado devolve 409",
  duplicado.status === 409,
  duplicado.status,
);
verificar(
  "código do erro é DUPLICATE_MAC_ADDRESS",
  duplicado.json?.code === "DUPLICATE_MAC_ADDRESS",
  duplicado.json?.code,
);

const propriedadeInexistente = await chamar("POST", "/api/stations", {
  ...base,
  mac_address: mac(5),
  property_id: 999999,
});
verificar(
  "propriedade inexistente devolve 409",
  propriedadeInexistente.status === 409,
  propriedadeInexistente.status,
);
verificar(
  "código do erro é PROPERTY_NOT_FOUND",
  propriedadeInexistente.json?.code === "PROPERTY_NOT_FOUND",
  propriedadeInexistente.json?.code,
);

// --- leitura ---------------------------------------------------------------
console.log("\nLeitura");
const lista = await chamar("GET", "/api/stations?page=1&limit=5");
verificar("listagem devolve 200", lista.status === 200, lista.status);
verificar(
  "listagem tem data e meta",
  Array.isArray(lista.json?.data) && Boolean(lista.json?.meta),
);
verificar(
  "meta tem os três campos do contrato",
  ["total_records", "total_pages", "current_page"].every(
    (k) => k in (lista.json?.meta ?? {}),
  ),
  lista.json?.meta,
);
verificar(
  "limit é respeitado",
  (lista.json?.data?.length ?? 0) <= 5,
  lista.json?.data?.length,
);

const porId = await chamar("GET", `/api/stations/${id}`);
verificar("busca por id devolve 200", porId.status === 200, porId.status);
verificar("devolve a estação certa", porId.json?.id === id, porId.json?.id);

const filtro = await chamar("GET", `/api/stations?property_id=${PROPERTY_ID}`);
verificar(
  "filtro por property_id só traz daquela propriedade",
  (filtro.json?.data ?? []).every((e) => e.property_id === PROPERTY_ID),
);

const inexistente = await chamar("GET", "/api/stations/999999");
verificar(
  "id inexistente devolve 404",
  inexistente.status === 404,
  inexistente.status,
);
verificar(
  "código do erro é STATION_NOT_FOUND",
  inexistente.json?.code === "STATION_NOT_FOUND",
  inexistente.json?.code,
);

// --- atualização -----------------------------------------------------------
console.log("\nAtualização");
const atualizado = await chamar("PUT", `/api/stations/${id}`, {
  ...base,
  name: `${NOME} renomeado`,
});
verificar(
  "PUT válido devolve 200",
  atualizado.status === 200,
  atualizado.status,
);
verificar(
  "o nome mudou",
  atualizado.json?.name === `${NOME} renomeado`,
  atualizado.json?.name,
);

const atualizaInexistente = await chamar("PUT", "/api/stations/999999", base);
verificar(
  "PUT em id inexistente devolve 404",
  atualizaInexistente.status === 404,
  atualizaInexistente.status,
);

// --- exclusão e limpeza ----------------------------------------------------
console.log("\nExclusão");
for (const idCriado of criados) {
  const excluido = await chamar("DELETE", `/api/stations/${idCriado}`);
  verificar(
    `DELETE da estação ${idCriado} devolve 204`,
    excluido.status === 204,
    excluido.status,
  );
}

const excluiDeNovo = await chamar("DELETE", `/api/stations/${id}`);
verificar(
  "DELETE repetido devolve 404",
  excluiDeNovo.status === 404,
  excluiDeNovo.status,
);

// --- resultado -------------------------------------------------------------
console.log(`\n${passou} ok, ${falhou} falha(s).`);
if (falhou > 0) {
  console.log(
    "Os dados criados pelo teste foram removidos, exceto onde o DELETE falhou.",
  );
  process.exit(1);
}
console.log("Tudo certo. Nenhum dado de teste ficou no banco.");
