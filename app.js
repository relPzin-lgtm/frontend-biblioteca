(() => {
  "use strict";

  // URL base da API. Pode ser alterada em "Configurações da API".
  const DEFAULT_API_URL = "https://github.com/relPzin-lgtm/aula-deploy";
  const API_STORAGE_KEY = "bibliotecaDigitalApiUrl";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const state = {
    books: [],
    filteredBooks: [],
    editingId: null,
    deletingBook: null,
    busy: false,
    apiUrl: normalizeBaseUrl(localStorage.getItem(API_STORAGE_KEY) || DEFAULT_API_URL)
  };

  const elements = {
    dashboardView: $("#dashboardView"),
    catalogView: $("#catalogView"),
    breadcrumbCurrent: $("#breadcrumbCurrent"),
    connectionPill: $("#connectionPill"),
    connectionText: $("#connectionText"),
    totalBooks: $("#totalBooks"),
    totalAuthors: $("#totalAuthors"),
    totalDated: $("#totalDated"),
    sidebarBookCount: $("#sidebarBookCount"),
    recentBooks: $("#recentBooks"),
    booksTableBody: $("#booksTableBody"),
    searchInput: $("#searchInput"),
    resultsCount: $("#resultsCount"),
    tableFooterText: $("#tableFooterText"),
    emptyState: $("#emptyState"),
    emptyTitle: $("#emptyTitle"),
    emptyMessage: $("#emptyMessage"),
    bookModal: $("#bookModal"),
    bookForm: $("#bookForm"),
    modalTitle: $("#modalTitle"),
    modalDescription: $("#modalDescription"),
    saveBookButton: $("#saveBookButton"),
    bookTitle: $("#bookTitle"),
    bookAuthor: $("#bookAuthor"),
    bookYear: $("#bookYear"),
    formError: $("#formError"),
    deleteModal: $("#deleteModal"),
    deleteDescription: $("#deleteDescription"),
    confirmDelete: $("#confirmDelete"),
    settingsModal: $("#settingsModal"),
    settingsForm: $("#settingsForm"),
    apiUrl: $("#apiUrl"),
    toastRegion: $("#toastRegion"),
    sidebar: $("#sidebar")
  };

  function normalizeBaseUrl(value) {
    return String(value || "").trim().replace(/\/+$/, "").replace(/\/api\/livros$/i, "");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function getBookId(book) {
    return book?.id ?? book?.livro_id ?? "";
  }

  function getBookTitle(book) {
    return String(book?.titulo ?? "Livro sem título");
  }

  function getBookAuthor(book) {
    return String(book?.autor ?? "Autor não informado");
  }

  function getBookYear(book) {
    return book?.ano === null || book?.ano === undefined || book?.ano === "" ? "" : String(book.ano);
  }

  function getInitials(title) {
    const words = String(title || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "L";
    return words.slice(0, 2).map(word => word[0]).join("").toUpperCase();
  }

  function toneFor(book) {
    const id = Number(getBookId(book));
    if (Number.isFinite(id)) return Math.abs(id) % 6;
    return getBookTitle(book).length % 6;
  }

  function bookCover(book) {
    return `<span class="book-cover tone-${toneFor(book)}" aria-hidden="true">${escapeHtml(getInitials(getBookTitle(book)))}</span>`;
  }

  async function apiRequest(path, options = {}) {
    const url = `${state.apiUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });

    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); }
      catch { data = { erro: text }; }
    }

    if (!response.ok) {
      const message = data?.erro || data?.error || `A API respondeu com status ${response.status}.`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function setConnection(connected, label) {
    elements.connectionPill.classList.toggle("offline", !connected);
    elements.connectionText.textContent = label;
  }

  function showToast(title, message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type === "error" ? "error" : ""}`;
    toast.innerHTML = `<span class="toast-symbol">${type === "error" ? "!" : "✓"}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div>`;
    elements.toastRegion.appendChild(toast);
    window.setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(5px)";
      window.setTimeout(() => toast.remove(), 220);
    }, 4200);
  }

  function showApiError(error, context = "Não foi possível carregar os dados.") {
    console.error(error);
    const isCors = error instanceof TypeError;
    const message = isCors
      ? "Não foi possível acessar a API. Confira a URL, a conexão e se o backend permite CORS para este site."
      : error.message || context;
    setConnection(false, "API indisponível");
    showToast("Falha na conexão", message, "error");
  }

  async function loadBooks({ silent = false } = {}) {
    if (state.busy) return;
    state.busy = true;
    if (!silent) {
      elements.recentBooks.innerHTML = '<div class="loading-state"><span class="loader"></span> Carregando livros...</div>';
      elements.booksTableBody.innerHTML = '<tr><td colspan="4"><div class="loading-state"><span class="loader"></span> Carregando acervo...</div></td></tr>';
    }

    try {
      const data = await apiRequest("/api/livros");
      if (!Array.isArray(data)) throw new Error("A resposta da API não é uma lista de livros. Confira o endpoint GET /api/livros.");
      state.books = data;
      setConnection(true, "API conectada");
      renderStats();
      renderRecent();
      applySearch();
    } catch (error) {
      showApiError(error);
      if (!state.books.length) {
        elements.recentBooks.innerHTML = `<div class="loading-state">Não foi possível carregar os livros. <button class="text-button" id="retryLoad">Tentar novamente →</button></div>`;
        elements.booksTableBody.innerHTML = `<tr><td colspan="4"><div class="loading-state">Falha ao carregar o acervo. Confira a URL da API e o CORS.</div></td></tr>`;
        $("#retryLoad")?.addEventListener("click", () => loadBooks());
      }
    } finally {
      state.busy = false;
    }
  }

  function renderStats() {
    const authors = new Set(state.books.map(book => getBookAuthor(book).trim().toLocaleLowerCase("pt-BR")).filter(Boolean));
    const dated = state.books.filter(book => getBookYear(book) !== "").length;
    elements.totalBooks.textContent = state.books.length.toLocaleString("pt-BR");
    elements.totalAuthors.textContent = authors.size.toLocaleString("pt-BR");
    elements.totalDated.textContent = dated.toLocaleString("pt-BR");
    elements.sidebarBookCount.textContent = state.books.length > 99 ? "99+" : String(state.books.length);
  }

  function renderRecent() {
    if (!state.books.length) {
      elements.recentBooks.innerHTML = `<div class="empty-state"><div class="empty-illustration">▤</div><h3>Seu acervo começa aqui</h3><p>Cadastre seu primeiro livro para começar a organizar a coleção.</p><button class="button button-primary" id="recentAddButton" type="button">＋ Cadastrar livro</button></div>`;
      $("#recentAddButton")?.addEventListener("click", () => openBookModal());
      return;
    }

    const recent = [...state.books].sort((a, b) => {
      const idA = Number(getBookId(a));
      const idB = Number(getBookId(b));
      if (Number.isFinite(idA) && Number.isFinite(idB)) return idB - idA;
      return getBookTitle(a).localeCompare(getBookTitle(b), "pt-BR");
    }).slice(0, 5);

    elements.recentBooks.innerHTML = recent.map(book => `
      <div class="recent-row">
        <div class="book-identity">${bookCover(book)}<div style="min-width:0"><div class="book-title" title="${escapeHtml(getBookTitle(book))}">${escapeHtml(getBookTitle(book))}</div><p class="book-author">${escapeHtml(getBookAuthor(book))}</p></div></div>
        <div class="row-meta"><span class="row-meta-label">PUBLICAÇÃO</span><span class="row-meta-value">${escapeHtml(getBookYear(book) || "Não informado")}</span></div>
        <div class="row-action"><button class="small-action" type="button" data-edit="${escapeHtml(getBookId(book))}" aria-label="Editar ${escapeHtml(getBookTitle(book))}" title="Editar">✎</button><button class="small-action delete" type="button" data-delete="${escapeHtml(getBookId(book))}" aria-label="Excluir ${escapeHtml(getBookTitle(book))}" title="Excluir">⌫</button></div>
      </div>`).join("");
  }

  function applySearch() {
    const query = elements.searchInput.value.trim().toLocaleLowerCase("pt-BR");
    state.filteredBooks = state.books.filter(book => {
      const searchable = [getBookTitle(book), getBookAuthor(book), getBookId(book), getBookYear(book)].join(" ").toLocaleLowerCase("pt-BR");
      return searchable.includes(query);
    });
    renderTable();
  }

  function renderTable() {
    const books = state.filteredBooks;
    elements.resultsCount.textContent = `${books.length} ${books.length === 1 ? "livro" : "livros"}`;
    elements.tableFooterText.textContent = books.length
      ? `Exibindo ${books.length} de ${state.books.length} registros`
      : "Nenhum registro para exibir";

    elements.emptyState.classList.toggle("hidden", books.length > 0);
    $(".table-scroll").classList.toggle("hidden", books.length === 0);
    $(".table-footer").classList.toggle("hidden", books.length === 0);

    if (!books.length) {
      const hasSearch = elements.searchInput.value.trim().length > 0;
      elements.emptyTitle.textContent = hasSearch ? "Nenhum resultado encontrado" : "Seu acervo está vazio";
      elements.emptyMessage.textContent = hasSearch
        ? "Tente buscar por outro título, autor ou código."
        : "Cadastre a primeira obra para começar a organizar sua biblioteca.";
      return;
    }

    elements.booksTableBody.innerHTML = books.map(book => `
      <tr>
        <td><div class="book-identity">${bookCover(book)}<div style="min-width:0"><div class="book-title" title="${escapeHtml(getBookTitle(book))}">${escapeHtml(getBookTitle(book))}</div><p class="book-author">${escapeHtml(getBookAuthor(book))}</p></div></div></td>
        <td><span class="id-badge">#${escapeHtml(getBookId(book) || "—")}</span></td>
        <td><span class="year-badge">${escapeHtml(getBookYear(book) || "—")}</span></td>
        <td><button class="small-action" type="button" data-edit="${escapeHtml(getBookId(book))}" aria-label="Editar ${escapeHtml(getBookTitle(book))}" title="Editar">✎</button><button class="small-action delete" type="button" data-delete="${escapeHtml(getBookId(book))}" aria-label="Excluir ${escapeHtml(getBookTitle(book))}" title="Excluir">⌫</button></td>
      </tr>`).join("");
  }

  function switchView(view) {
    const catalog = view === "catalogo";
    elements.dashboardView.classList.toggle("hidden", catalog);
    elements.catalogView.classList.toggle("hidden", !catalog);
    elements.breadcrumbCurrent.textContent = catalog ? "Acervo de livros" : "Visão geral";
    $$("[data-view]").forEach(link => link.classList.toggle("active", link.dataset.view === view));
    elements.sidebar.classList.remove("open");
    if (catalog) window.setTimeout(() => elements.searchInput.focus(), 80);
  }

  function openBookModal(book = null) {
    state.editingId = book ? getBookId(book) : null;
    elements.bookForm.reset();
    elements.formError.classList.add("hidden");
    elements.formError.textContent = "";
    const editing = Boolean(book);
    elements.modalTitle.textContent = editing ? "Editar livro" : "Cadastrar livro";
    elements.modalDescription.textContent = editing ? "Atualize as informações desta obra." : "Preencha os dados para adicionar uma nova obra.";
    elements.saveBookButton.innerHTML = editing ? "Salvar alterações" : '<span class="button-plus">＋</span> Salvar livro';
    elements.bookTitle.value = editing ? getBookTitle(book) : "";
    elements.bookAuthor.value = editing ? getBookAuthor(book) : "";
    elements.bookYear.value = editing ? getBookYear(book) : "";
    elements.bookModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    window.setTimeout(() => elements.bookTitle.focus(), 60);
  }

  function closeBookModal() {
    elements.bookModal.classList.add("hidden");
    document.body.style.overflow = "";
    state.editingId = null;
  }

  function showFormError(message) {
    elements.formError.textContent = message;
    elements.formError.classList.remove("hidden");
  }

  async function saveBook(event) {
    event.preventDefault();
    if (state.busy) return;

    const titulo = elements.bookTitle.value.trim();
    const autor = elements.bookAuthor.value.trim();
    const yearValue = elements.bookYear.value.trim();
    const ano = yearValue === "" ? null : Number(yearValue);

    if (!titulo || !autor) {
      showFormError("Preencha o título e o autor para continuar.");
      return;
    }
    if (yearValue !== "" && (!Number.isInteger(ano) || ano < 0 || ano > 2200)) {
      showFormError("Informe um ano válido entre 0 e 2200.");
      return;
    }

    const editing = state.editingId !== null;
    const path = editing ? `/api/livros/${encodeURIComponent(state.editingId)}` : "/api/livros";
    const oldLabel = elements.saveBookButton.innerHTML;
    elements.saveBookButton.disabled = true;
    elements.saveBookButton.innerHTML = '<span class="loader"></span> Salvando...';

    try {
      await apiRequest(path, { method: editing ? "PUT" : "POST", body: JSON.stringify({ titulo, autor, ano }) });
      closeBookModal();
      showToast(editing ? "Livro atualizado" : "Livro cadastrado", editing ? "As alterações foram salvas com sucesso." : "A nova obra foi adicionada ao acervo.");
      await loadBooks({ silent: true });
    } catch (error) {
      console.error(error);
      showFormError(error instanceof TypeError
        ? "Não foi possível acessar a API. Confira a URL e a configuração de CORS do backend."
        : error.message || "Não foi possível salvar o livro.");
    } finally {
      elements.saveBookButton.disabled = false;
      elements.saveBookButton.innerHTML = oldLabel;
    }
  }

  function openDeleteModal(book) {
    state.deletingBook = book;
    elements.deleteDescription.textContent = `O livro “${getBookTitle(book)}” será removido permanentemente do acervo. Esta ação não pode ser desfeita.`;
    elements.deleteModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeDeleteModal() {
    elements.deleteModal.classList.add("hidden");
    document.body.style.overflow = "";
    state.deletingBook = null;
  }

  async function deleteBook() {
    if (!state.deletingBook || state.busy) return;
    const book = state.deletingBook;
    const id = getBookId(book);
    const oldLabel = elements.confirmDelete.textContent;
    elements.confirmDelete.disabled = true;
    elements.confirmDelete.textContent = "Excluindo...";
    try {
      await apiRequest(`/api/livros/${encodeURIComponent(id)}`, { method: "DELETE" });
      closeDeleteModal();
      showToast("Livro excluído", "O registro foi removido do acervo.");
      await loadBooks({ silent: true });
    } catch (error) {
      showToast("Não foi possível excluir", error.message || "Tente novamente.", "error");
    } finally {
      elements.confirmDelete.disabled = false;
      elements.confirmDelete.textContent = oldLabel;
    }
  }

  function openSettings() {
    elements.apiUrl.value = state.apiUrl;
    elements.settingsModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeSettings() {
    elements.settingsModal.classList.add("hidden");
    document.body.style.overflow = "";
  }

  async function saveSettings(event) {
    event.preventDefault();
    const value = normalizeBaseUrl(elements.apiUrl.value);
    try {
      const parsed = new URL(value);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Use uma URL que comece com http:// ou https://.");
    } catch (error) {
      showToast("URL inválida", error.message || "Informe a URL completa do seu Worker.", "error");
      return;
    }
    state.apiUrl = value;
    localStorage.setItem(API_STORAGE_KEY, value);
    closeSettings();
    state.books = [];
    await loadBooks();
  }

  function handleBookAction(event) {
    const editButton = event.target.closest("[data-edit]");
    const deleteButton = event.target.closest("[data-delete]");
    if (editButton) {
      const book = state.books.find(item => String(getBookId(item)) === editButton.dataset.edit);
      if (book) openBookModal(book);
    }
    if (deleteButton) {
      const book = state.books.find(item => String(getBookId(item)) === deleteButton.dataset.delete);
      if (book) openDeleteModal(book);
    }
  }

  // Navegação
  $$("[data-view]").forEach(link => link.addEventListener("click", event => {
    event.preventDefault();
    switchView(link.dataset.view);
  }));
  $$("[data-go-catalog]").forEach(button => button.addEventListener("click", () => switchView("catalogo")));

  // Cadastro / edição
  ["#newBookButton", "#bannerNewBook", "#catalogNewBook", "#emptyAddButton"].forEach(selector => {
    $(selector)?.addEventListener("click", () => openBookModal());
  });
  $("#closeBookModal").addEventListener("click", closeBookModal);
  $("#cancelBook").addEventListener("click", closeBookModal);
  elements.bookForm.addEventListener("submit", saveBook);
  elements.recentBooks.addEventListener("click", handleBookAction);
  elements.booksTableBody.addEventListener("click", handleBookAction);

  // Exclusão
  $("#cancelDelete").addEventListener("click", closeDeleteModal);
  elements.confirmDelete.addEventListener("click", deleteBook);

  // API
  $("#openSettings").addEventListener("click", openSettings);
  $("#closeSettings").addEventListener("click", closeSettings);
  $("#cancelSettings").addEventListener("click", closeSettings);
  elements.settingsForm.addEventListener("submit", saveSettings);
  $("#refreshButton").addEventListener("click", () => loadBooks());
  $("#catalogRefresh").addEventListener("click", () => loadBooks());
  elements.searchInput.addEventListener("input", applySearch);

  // Menu móvel
  $("#mobileMenu").addEventListener("click", () => elements.sidebar.classList.toggle("open"));
  document.addEventListener("click", event => {
    if (window.innerWidth <= 820 && elements.sidebar.classList.contains("open")
      && !elements.sidebar.contains(event.target) && !event.target.closest("#mobileMenu")) {
      elements.sidebar.classList.remove("open");
    }
  });

  // Fechar modais com Escape e clicando no fundo.
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if (!elements.bookModal.classList.contains("hidden")) closeBookModal();
      if (!elements.deleteModal.classList.contains("hidden")) closeDeleteModal();
      if (!elements.settingsModal.classList.contains("hidden")) closeSettings();
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      switchView("catalogo");
      elements.searchInput.focus();
    }
  });
  [elements.bookModal, elements.deleteModal, elements.settingsModal].forEach(modal => {
    modal.addEventListener("click", event => {
      if (event.target !== modal) return;
      if (modal === elements.bookModal) closeBookModal();
      if (modal === elements.deleteModal) closeDeleteModal();
      if (modal === elements.settingsModal) closeSettings();
    });
  });

  $("#currentYear").textContent = new Date().getFullYear();
  loadBooks();
})();
