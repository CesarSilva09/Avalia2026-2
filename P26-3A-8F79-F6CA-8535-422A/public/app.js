// Shared To-Do — P26-3A-8F79-F6CA-8535-422A. JavaScript puro; o servidor é a fonte da verdade.
"use strict";

const $ = (id) => document.getElementById(id);
const AVATAR_PADRAO = "https://cdn.discordapp.com/embed/avatars/0.png";
const PAPEL = { owner: "dono", member: "membro" };

let me = null;            // usuário logado
let listas = [];          // GET /api/lists
let atual = null;         // { list, members, tasks } da lista aberta
let pendentes = 0;        // requisições de alteração em andamento
let seqCarga = 0;         // descarta respostas de recarga antigas
const subAbertos = new Set(); // ids das tarefas com o form de subtarefa aberto

// ---------- API ----------
class ApiErro extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

async function api(method, path, body) {
  const opts = { method, credentials: "same-origin", headers: {} };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(path, opts);
  } catch {
    throw new ApiErro(0, "Sem conexão com o servidor.");
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiErro(res.status, data.error || `Erro ${res.status}`);
  return data;
}

// ---------- Avisos ----------
let avisoTimer;
function aviso(texto, erro = false) {
  const el = $("aviso");
  clearTimeout(avisoTimer);
  el.classList.toggle("erro", erro);
  el.textContent = texto;
  if (!erro) avisoTimer = setTimeout(() => { el.textContent = ""; }, 4000);
}

function tratarErro(e) {
  if (e.status === 401) return mostrarLogin();
  aviso(e.message || "Algo deu errado.", true);
}

// Desabilita os controles durante a requisição e trata erros.
async function executar(controles, fn) {
  controles.forEach((c) => { c.disabled = true; });
  pendentes++;
  try {
    await fn();
    return true;
  } catch (e) {
    tratarErro(e);
    return false;
  } finally {
    pendentes--;
    controles.forEach((c) => { c.disabled = false; });
  }
}

// ---------- Helpers de DOM ----------
function el(tag, props = {}, ...filhos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k in n) n[k] = v;
    else n.setAttribute(k, v);
  }
  filhos.forEach((f) => f && n.append(f));
  return n;
}

function avatar(user, pequeno = false) {
  return el("img", {
    class: pequeno ? "avatar pq" : "avatar",
    src: user.avatarUrl || AVATAR_PADRAO,
    alt: `Avatar de ${user.username}`,
    width: pequeno ? 24 : 32,
    height: pequeno ? 24 : 32,
    loading: "lazy",
  });
}

function formControles(form) {
  return Array.from(form.elements);
}

// ---------- Telas ----------
function mostrarLogin() {
  me = null;
  atual = null;
  $("appView").hidden = true;
  $("profile").hidden = true;
  $("loginView").hidden = false;
}

function mostrarApp() {
  $("loginView").hidden = true;
  $("appView").hidden = false;
  $("profile").hidden = false;
  $("meAvatar").src = me.avatarUrl || AVATAR_PADRAO;
  $("meAvatar").alt = `Avatar de ${me.username}`;
  $("meName").textContent = me.username;
}

// ---------- Minhas listas ----------
async function carregarListas() {
  const data = await api("GET", "/api/lists");
  listas = data.lists;
  renderListas();
}

function renderListas() {
  const ul = $("listas");
  const idAberto = atual ? atual.list.id : null;
  ul.replaceChildren(...listas.map((l) => {
    const a = el("a", { href: `#/lista/${l.id}` },
      el("span", { class: "nome", text: l.name }),
      el("span", { class: "meta" },
        el("span", { class: "pill", text: PAPEL[l.role] || l.role }),
        ` · ${l.doneCount}/${l.taskCount} feitas · ${l.memberCount} ${l.memberCount === 1 ? "membro" : "membros"}`));
    if (l.id === idAberto) a.setAttribute("aria-current", "page");
    return el("li", {}, a);
  }));
  $("semListas").hidden = listas.length > 0;
}

// ---------- Lista aberta ----------
function idDaRota() {
  const m = location.hash.match(/^#\/lista\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

async function carregarLista(id) {
  const seq = ++seqCarga;
  const data = await api("GET", `/api/lists/${id}`);
  if (seq !== seqCarga || idDaRota() !== id) return; // resposta velha
  atual = data;
  // Atualiza o progresso no painel sem outra requisição.
  const i = listas.findIndex((l) => l.id === data.list.id);
  if (i >= 0) listas[i] = data.list; else listas.push(data.list);
  renderListas();
  renderLista();
}

function renderLista() {
  const { list, members, tasks } = atual;
  $("listaVazia").hidden = true;
  $("listaConteudo").hidden = false;
  $("listaNome").textContent = list.name;
  $("listaCodigo").textContent = list.shareCode;
  document.title = `${list.name} — Shared To-Do`;

  const feitas = tasks.filter((t) => t.done).length;
  $("listaProgressoTexto").textContent = `Progresso: ${feitas} de ${tasks.length} concluídas`;
  $("listaProgresso").max = Math.max(tasks.length, 1);
  $("listaProgresso").value = feitas;

  $("membros").replaceChildren(...members.map((m) =>
    el("li", {}, avatar(m, true), el("span", { text: m.role === "owner" ? `${m.username} (dono)` : m.username }))));

  // Select do formulário de nova tarefa: preserva a escolha atual.
  const sel = $("novaTarefaResp");
  const escolhido = sel.value;
  sel.replaceChildren(...opcoesResponsavel(members));
  if (members.some((m) => m.id === escolhido)) sel.value = escolhido;

  // Preserva texto e foco dos inputs de subtarefa recriados.
  const ativo = document.activeElement;
  const focoId = ativo && ativo.id && $("tarefas").contains(ativo) ? ativo.id : null;
  const sel0 = focoId && ativo.type === "text" ? [ativo.selectionStart, ativo.selectionEnd] : null;
  const valores = {};
  $("tarefas").querySelectorAll("input[type=text]").forEach((i) => { valores[i.id] = i.value; });

  const filhos = new Map();
  tasks.filter((t) => t.parentId !== null).forEach((t) => {
    if (!filhos.has(t.parentId)) filhos.set(t.parentId, []);
    filhos.get(t.parentId).push(t);
  });
  const principais = tasks.filter((t) => t.parentId === null);
  $("tarefas").replaceChildren(...principais.map((t) => itemTarefa(t, filhos.get(t.id) || [], members)));
  $("semTarefas").hidden = principais.length > 0;

  $("tarefas").querySelectorAll("input[type=text]").forEach((i) => {
    if (i.id in valores) i.value = valores[i.id];
  });
  const novoFoco = focoId && $(focoId);
  if (novoFoco) {
    novoFoco.focus();
    if (sel0) novoFoco.setSelectionRange(sel0[0], sel0[1]);
  }
}

function opcoesResponsavel(members) {
  return [el("option", { value: "", text: "Sem responsável" }),
    ...members.map((m) => el("option", { value: m.id, text: m.username }))];
}

function itemTarefa(t, subs, members) {
  const li = el("li", { class: t.done ? "tarefa feita" : "tarefa" });

  const check = el("input", { type: "checkbox", id: `done-${t.id}`, checked: t.done });
  check.addEventListener("change", () => executar([check], async () => {
    await api("PATCH", `/api/tasks/${t.id}`, { done: check.checked });
    await recarregar();
  }).then((ok) => { if (!ok) check.checked = t.done; }));

  const resp = t.assignee
    ? el("span", { class: "resp" }, avatar(t.assignee, true), el("span", { text: t.assignee.username }))
    : el("span", { class: "resp", text: "sem responsável" });

  const selId = `resp-${t.id}`;
  const sel = el("select", { id: selId, class: "resp-select" }, ...opcoesResponsavel(members));
  sel.value = t.assignee ? t.assignee.id : "";
  sel.addEventListener("change", () => executar([sel], async () => {
    await api("PATCH", `/api/tasks/${t.id}`, { assigneeId: sel.value || null });
    await recarregar();
  }).then((ok) => { if (!ok) sel.value = t.assignee ? t.assignee.id : ""; }));

  const excluir = el("button", { type: "button", class: "btn-ghost btn-perigo", text: "Excluir" });
  excluir.setAttribute("aria-label", `Excluir tarefa ${t.title}`);
  excluir.addEventListener("click", () => {
    const aviso2 = subs.length ? " As subtarefas também serão excluídas." : "";
    if (!confirm(`Excluir "${t.title}"?${aviso2}`)) return;
    executar([excluir], async () => {
      await api("DELETE", `/api/tasks/${t.id}`);
      subAbertos.delete(t.id);
      await recarregar();
      aviso("Tarefa excluída.");
    });
  });

  const acoes = el("div", { class: "acoes" });
  li.append(el("div", { class: "tarefa-linha" },
    el("label", { class: "check", htmlFor: check.id }, check, el("span", { text: t.title })),
    resp,
    el("label", { class: "sr-only", htmlFor: selId, text: `Responsável por ${t.title}` }),
    sel,
    acoes));

  if (t.parentId === null) {
    const abrir = el("button", { type: "button", class: "btn-ghost", text: "+ Subtarefa" });
    abrir.setAttribute("aria-expanded", String(subAbertos.has(t.id)));
    abrir.setAttribute("aria-label", `Adicionar subtarefa em ${t.title}`);
    acoes.append(abrir, excluir);

    const form = formSubtarefa(t);
    form.hidden = !subAbertos.has(t.id);
    abrir.addEventListener("click", () => {
      const abrirAgora = form.hidden;
      form.hidden = !abrirAgora;
      abrir.setAttribute("aria-expanded", String(abrirAgora));
      if (abrirAgora) { subAbertos.add(t.id); form.querySelector("input").focus(); }
      else subAbertos.delete(t.id);
    });
    li.append(form);

    if (subs.length) {
      li.append(el("ul", { class: "subtarefas", "aria-label": `Subtarefas de ${t.title}` },
        ...subs.map((s) => itemTarefa(s, [], members))));
    }
  } else {
    acoes.append(excluir);
  }
  return li;
}

function formSubtarefa(t) {
  const inputId = `sub-${t.id}`;
  const input = el("input", { type: "text", id: inputId, maxLength: 200, required: true, placeholder: "Título da subtarefa" });
  const btn = el("button", { type: "submit", class: "btn-primary", text: "Adicionar" });
  const form = el("form", { class: "sub-form" },
    el("label", { class: "sr-only", htmlFor: inputId, text: `Nova subtarefa de ${t.title}` }), input, btn);
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const title = input.value.trim();
    if (!title) return;
    executar([input, btn], async () => {
      await api("POST", `/api/lists/${atual.list.id}/tasks`, { title, parentId: t.id });
      subAbertos.delete(t.id);
      input.value = "";
      await recarregar();
    });
  });
  return form;
}

async function recarregar() {
  const id = idDaRota();
  if (id !== null) await carregarLista(id);
}

// ---------- Rotas ----------
async function rota() {
  if (!me) return;
  const id = idDaRota();
  subAbertos.clear();
  if (id === null) {
    atual = null;
    $("listaConteudo").hidden = true;
    $("listaVazia").hidden = false;
    document.title = "Shared To-Do — P26-3A-8F79-F6CA-8535-422A";
    renderListas();
    return;
  }
  try {
    await carregarLista(id);
    $("listaNome").focus();
  } catch (e) {
    tratarErro(e);
    if (e.status === 403 || e.status === 404) location.hash = "";
  }
}

// ---------- Formulários fixos ----------
$("novaListaForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  const name = $("novaListaNome").value.trim();
  if (!name) return;
  executar(formControles(form), async () => {
    const { list } = await api("POST", "/api/lists", { name });
    form.reset();
    await carregarListas();
    location.hash = `#/lista/${list.id}`;
    aviso("Lista criada. Compartilhe o código com os colegas.");
  });
});

$("entrarForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  const code = $("entrarCodigo").value.trim().toUpperCase();
  if (!code) return;
  executar(formControles(form), async () => {
    const { list } = await api("POST", "/api/lists/join", { code });
    form.reset();
    await carregarListas();
    location.hash = `#/lista/${list.id}`;
    aviso(`Você entrou em "${list.name}".`);
  });
});

$("novaTarefaForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  const title = $("novaTarefaTitulo").value.trim();
  if (!title || !atual) return;
  const body = { title };
  if ($("novaTarefaResp").value) body.assigneeId = $("novaTarefaResp").value;
  executar(formControles(form), async () => {
    await api("POST", `/api/lists/${atual.list.id}/tasks`, body);
    $("novaTarefaTitulo").value = "";
    await recarregar();
  }).then(() => $("novaTarefaTitulo").focus());
});

$("copiarBtn").addEventListener("click", async () => {
  const codigo = $("listaCodigo").textContent;
  try {
    await navigator.clipboard.writeText(codigo);
    aviso(`Código ${codigo} copiado.`);
  } catch {
    // Sem permissão de área de transferência: seleciona o texto para cópia manual.
    getSelection().selectAllChildren($("listaCodigo"));
    aviso("Não foi possível copiar automaticamente; o código está selecionado.", true);
  }
});

$("logoutBtn").addEventListener("click", () => executar([$("logoutBtn")], async () => {
  await api("POST", "/api/auth/logout");
  history.replaceState(null, "", "/");
  mostrarLogin();
}));

window.addEventListener("hashchange", rota);

// ---------- Atualização periódica ----------
setInterval(() => {
  if (!me || !atual || pendentes > 0 || document.visibilityState !== "visible") return;
  // Um select aberto seria fechado ao redesenhar; espera o usuário terminar.
  const ativo = document.activeElement;
  if (ativo && ativo.tagName === "SELECT" && $("listaConteudo").contains(ativo)) return;
  recarregar().catch(tratarErro);
}, 5000);

// ---------- Início ----------
(async function iniciar() {
  const params = new URLSearchParams(location.search);
  const erroAuth = params.get("auth_error");
  if (erroAuth) {
    $("authError").textContent = `Não foi possível entrar com o Discord (${erroAuth}). Tente novamente.`;
    $("authError").hidden = false;
    history.replaceState(null, "", location.pathname + location.hash);
  }
  try {
    const data = await api("GET", "/api/me");
    me = data.user;
    mostrarApp();
    await carregarListas();
    await rota();
  } catch (e) {
    tratarErro(e);
    if (!me) mostrarLogin();
  }
})();
