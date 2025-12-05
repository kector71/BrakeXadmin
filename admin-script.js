// Este script debe ser cargado como type="module" en el HTML
const {
    auth,
    db,
    collection,
    doc,
    setDoc,
    deleteDoc,
    onSnapshot,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    serverTimestamp,
    addDoc,
    query,
    orderBy,
    limit,
    setPersistence,
    browserSessionPersistence
} = window.firebaseTools;

document.addEventListener('DOMContentLoaded', () => {

    /**
     * Objeto principal que encapsula toda la lógica del panel de administración.
     * Versión 2.10 (Anonymize History)
     */
    const AdminPanel = {

        // ----- ESTADO DE LA APLICACIÓN -----
        state: {
            allPadsCache: [],
            currentApps: [],
            currentEditingId: null,
            editingAppIndex: -1,
            totalAppsInList: 0,
            autocompleteData: {},
            imagePreviewTimeout: null,
            searchTimeout: null,
            inactivityTimer: null,
            confirmResolve: null,
            originalPadSnapshot: null, // "Foto" de la pastilla al cargarla
            // Índices para búsqueda optimizada
            searchIndexes: {
                ref: new Map(),
                fmsi: new Map(),
                oem: new Map(),
                app: new Map()
            }
        },

        // ----- CONSTANTES Y CONFIGURACIÓN -----
        config: {
            INACTIVITY_DURATION: 15 * 60 * 1000, // 15 minutos
            anioRegex: /^(?:(\d{2}|\d{4})(?:-(\d{2}|\d{4}))?)$/,
            medidasRegex: /^\d+(\.\d+)?\s*x\s*\d+(\.\d+)?(,\s*\d+(\.\d+)?\s*x\s*\d+(\.\d+)?)*$/,
            urlRegex: /^https?:\/\/.+/i,
            MAX_STRING_LENGTH: 500,
            MAX_ARRAY_LENGTH: 100
        },

        // ----- ELEMENTOS DEL DOM -----
        dom: {},

        // ----- INICIALIZACIÓN -----
        /**
         * Método principal de inicialización.
         */
        init() {
            console.log("Admin script 2.10 (Anonymize History) loaded. DOM ready.");
            // 1. Obtener todos los elementos del DOM
            if (!this.getDomElements()) {
                console.error("Error crítico: No se pudieron obtener los elementos esenciales del DOM. La aplicación no puede continuar.");
                return;
            }

            // 2. Configurar listeners de eventos
            this.initEventListeners();

            // 3. Inicializar el modo oscuro (antes de que Firebase cargue)
            this.initDarkMode();

            // 4. Inicializar funcionalidad "Recordarme"
            this.initRememberMe();

            // 4.1 Inicializar validación visual de campos
            this.logic.initFieldValidation();

            // 5. Conectar a Firebase (esto manejará la lógica de login/logout)
            this.api.initFirebase();

            // 6. Configurar UI inicial
            this.ui.setActiveSection('dashboard');
            this.ui.updateSearchPlaceholder();
            console.log("Admin panel UI inicializado, conectando a Firebase...");
        },

        /**
         * Obtiene y almacena todas las referencias a elementos del DOM.
         * @returns {boolean} True si los elementos esenciales fueron encontrados, false si no.
         */
        getDomElements() {
            try {
                console.log("Attempting to obtain DOM elements...");
                const getEl = id => document.getElementById(id);
                this.dom = {
                    // --- Elementos de Login/App ---
                    loginContainer: getEl('login-container'),
                    loginForm: getEl('login-form'),
                    loginEmail: getEl('login-email'),
                    loginPassword: getEl('login-password'),
                    loginPasswordToggle: getEl('login-password-toggle'),
                    loginBtn: getEl('login-btn'),
                    loginMessage: getEl('login-message'),
                    mainAppContainer: getEl('main-app-container'),
                    floatingBtnContainer: getEl('floating-btn-container'),
                    logoutBtn: getEl('logout-btn'),
                    // --- Elementos del Panel (Búsqueda, Formulario Principal, Apps) ---
                    navItems: document.querySelectorAll('.nav-item'),
                    contentSections: document.querySelectorAll('.content-section'),
                    pageTitle: getEl('page-title'),
                    padCountDashboard: getEl('pad-count-dashboard'),
                    appsTotalDashboard: getEl('apps-total-dashboard'),
                    exportJsonBtn: getEl('export-json-btn'),
                    exportExcelBtn: getEl('export-excel-btn'),
                    connectionStatus: getEl('connection-status'),
                    connectionStatusText: getEl('connection-status-text'),
                    searchRef: getEl('search-ref'),
                    searchType: getEl('search-type'),
                    searchBtn: getEl('search-btn'),
                    searchResults: getEl('search-results'),
                    clearSearchBtn: getEl('clear-search-btn'),
                    formModeTitle: getEl('form-mode-title'),
                    editIndexInput: getEl('edit-index'),
                    saveButtonText: getEl('save-button-text'),
                    appFormDescription: getEl('app-form-description'),
                    padFormMain: getEl('pad-form-main'),
                    padRef: getEl('pad-ref'),
                    padOem: getEl('pad-oem'),
                    padFmsi: getEl('pad-fmsi'),
                    padPosicion: getEl('pad-posicion'),
                    padMedidas: getEl('pad-medidas'),
                    padImagenes: getEl('pad-imagenes'),
                    imagePreviewContainer: getEl('image-preview-container'),
                    appForm: getEl('app-form'),
                    editingAppIndexInput: getEl('editing-app-index'),
                    appMarca: getEl('app-marca'),
                    appSerie: getEl('app-serie'),
                    appLitros: getEl('app-litros'),
                    appAnio: getEl('app-anio'),
                    appEspec: getEl('app-especificacion'),
                    addUpdateAppBtn: getEl('add-update-app-btn'),
                    addAppButtonText: getEl('add-app-button-text'),
                    cancelEditAppBtn: getEl('cancel-edit-app-btn'),
                    currentAppsList: getEl('current-apps-list'),
                    savePadBtn: getEl('save-pad-btn'),
                    deletePadBtn: getEl('delete-pad-btn'),
                    duplicatePadBtn: getEl('duplicate-pad-btn'),
                    darkBtn: getEl('darkBtn'),
                    themeToggleLogin: getEl('theme-toggle-login'),
                    sunIcon: document.querySelector('.lp-icon-sun'),
                    moonIcon: document.querySelector('.lp-icon-moon'),
                    savePadStatus: getEl('save-pad-status'),
                    confirmModalOverlay: getEl('confirm-modal-overlay'),
                    confirmModalContent: document.querySelector('#confirm-modal-content'),
                    confirmModalTitle: getEl('confirm-modal-title'),
                    confirmModalMessage: getEl('confirm-modal-message'),
                    confirmModalBtnYes: getEl('confirm-modal-btn-yes'),
                    confirmModalBtnNo: getEl('confirm-modal-btn-no'),
                    marcasList: getEl('marcas-list'),
                    seriesList: getEl('series-list'),
                    // --- Elementos del Historial ---
                    historyLogTableBody: getEl('history-log-table-body'),
                    // --- Filtro de Aplicaciones ---
                    filterAppsInput: getEl('filter-apps-input')
                };

                // Verificación ESENCIAL
                if (!this.dom.loginContainer || !this.dom.mainAppContainer || !this.dom.pageTitle || !this.dom.darkBtn) {
                    throw new Error("Elementos esenciales (Contenedores principales) del layout no encontrados.");
                }
                console.log("DOM elements obtained successfully.");
                return true;

            } catch (error) {
                console.error("Error obtaining DOM elements:", error);
                return false;
            }
        },

        // =============================================
        // FUNCIONES DE INTERFAZ DE USUARIO (UI)
        // =============================================
        ui: {
            /**
             * Muestra un modal de confirmación.
             * @returns {Promise<boolean>} Resuelve true si el usuario confirma, false si cancela.
             */
            showCustomConfirm(message, title = "Confirmar Acción", confirmText = "Confirmar", confirmClass = "btn-danger") {
                if (!this.dom.confirmModalOverlay) return Promise.resolve(false);
                this.dom.confirmModalTitle.textContent = title;
                this.dom.confirmModalMessage.textContent = message;
                this.dom.confirmModalBtnYes.textContent = confirmText;
                this.dom.confirmModalBtnYes.className = 'btn';
                this.dom.confirmModalBtnYes.classList.add(confirmClass);
                this.dom.confirmModalOverlay.style.display = 'flex';
                setTimeout(() => this.dom.confirmModalOverlay.classList.add('visible'), 10);
                return new Promise((resolve) => { this.state.confirmResolve = resolve; });
            },

            /**
             * Oculta el modal de confirmación.
             */
            hideCustomConfirm(result) {
                if (!this.dom.confirmModalOverlay) return;
                this.dom.confirmModalOverlay.classList.remove('visible');
                setTimeout(() => {
                    this.dom.confirmModalOverlay.style.display = 'none';
                    if (this.state.confirmResolve) {
                        this.state.confirmResolve(result);
                        this.state.confirmResolve = null;
                    }
                }, 200);
            },

            /**
             * Activa una sección de contenido y resalta su item de navegación.
             */
            setActiveSection(sectionId) {
                if (!sectionId || typeof sectionId !== 'string' || !this.dom.contentSections || !this.dom.navItems) return;
                this.dom.contentSections.forEach(section => section.classList.remove('active'));
                this.dom.navItems.forEach(item => {
                    if (item.dataset && typeof item.dataset.section !== 'undefined') {
                        item.classList.toggle('active', item.dataset.section === sectionId);
                    }
                });
                const activeSection = document.getElementById(sectionId);
                if (activeSection) {
                    activeSection.classList.add('active');
                    const navItem = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
                    if (this.dom.pageTitle && navItem) {
                        const titleSpan = navItem.querySelector('span:last-child');
                        if (titleSpan) this.dom.pageTitle.textContent = titleSpan.textContent || 'Admin Panel';
                    }
                } else {
                    console.error(`Sección con ID '${sectionId}' no encontrada. Volviendo a dashboard.`);
                    if (sectionId !== 'dashboard') this.ui.setActiveSection('dashboard'); // Evitar bucle infinito
                }
            },

            /**
             * Renderiza las previsualizaciones de imágenes desde el campo de texto.
             */
            renderImagePreview() {
                if (!this.dom.imagePreviewContainer || !this.dom.padImagenes) return;
                const imageUrls = this.dom.padImagenes.value.split(',').map(url => url.trim()).filter(Boolean);
                this.dom.imagePreviewContainer.innerHTML = '';
                if (imageUrls.length === 0) return;
                imageUrls.forEach(url => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'preview-image-wrapper';
                    const img = document.createElement('img');
                    img.src = url;
                    img.alt = 'Previsualización';
                    img.onerror = () => {
                        img.style.display = 'none';
                        const errorIcon = document.createElement('span');
                        errorIcon.className = 'material-icons-outlined error-icon';
                        errorIcon.textContent = 'broken_image';
                        wrapper.appendChild(errorIcon);
                    };
                    wrapper.appendChild(img);
                    this.dom.imagePreviewContainer.appendChild(wrapper);
                });
            },

            /**
             * Actualiza el placeholder del campo de búsqueda según el tipo.
             */
            updateSearchPlaceholder() {
                if (!this.dom.searchType || !this.dom.searchRef) return;
                const type = this.dom.searchType.value;
                switch (type) {
                    case 'ref': this.dom.searchRef.placeholder = "Ej: 7104INC"; break;
                    case 'fmsi': this.dom.searchRef.placeholder = "Ej: D1047"; break;
                    case 'oem': this.dom.searchRef.placeholder = "Ej: 123456789"; break;
                    case 'app': this.dom.searchRef.placeholder = "Ej: Chevrolet Spark"; break;
                }
            },

            /**
             * Resetea el formulario de aplicaciones.
             */
            resetAppForm() {
                if (this.dom.appForm) this.dom.appForm.reset();
                if (this.dom.editingAppIndexInput) this.dom.editingAppIndexInput.value = "-1";
                this.state.editingAppIndex = -1;
                if (this.dom.addAppButtonText) this.dom.addAppButtonText.textContent = "Añadir App";
                if (this.dom.addUpdateAppBtn) {
                    this.dom.addUpdateAppBtn.classList.remove('btn-primary');
                    this.dom.addUpdateAppBtn.classList.add('btn-tertiary');
                }
                if (this.dom.cancelEditAppBtn) this.dom.cancelEditAppBtn.style.display = 'none';
                if (this.dom.appFormDescription) this.dom.appFormDescription.textContent = "Añade vehículos compatibles.";
                if (this.dom.appAnio) this.dom.appAnio.classList.remove('is-valid', 'is-invalid');
                if (this.dom.seriesList) this.dom.seriesList.innerHTML = '';
                if (this.dom.filterAppsInput) this.dom.filterAppsInput.value = ''; // Limpiar filtro
            },

            /**
             * Resetea todos los formularios al modo "Crear Nuevo".
             */
            resetFormsAndMode() {
                if (this.dom.padFormMain) this.dom.padFormMain.reset();
                this.state.currentEditingId = null;
                this.state.currentApps = [];
                this.state.originalPadSnapshot = null; // Borra la "foto"

                if (this.dom.formModeTitle) this.dom.formModeTitle.textContent = "Añadir Nueva Pastilla";
                if (this.dom.saveButtonText) this.dom.saveButtonText.textContent = "Guardar Pastilla";
                if (this.dom.savePadBtn) {
                    this.dom.savePadBtn.classList.remove('btn-danger', 'btn-secondary');
                    this.dom.savePadBtn.classList.add('btn-primary');
                }
                if (this.dom.deletePadBtn) this.dom.deletePadBtn.style.display = 'none';
                if (this.dom.duplicatePadBtn) this.dom.duplicatePadBtn.style.display = 'none';
                if (this.dom.searchRef) this.dom.searchRef.value = '';
                if (this.dom.searchResults) this.dom.searchResults.innerHTML = '';
                if (this.dom.clearSearchBtn) this.dom.clearSearchBtn.style.display = 'none';
                if (this.dom.imagePreviewContainer) this.dom.imagePreviewContainer.innerHTML = '';
                if (this.dom.padMedidas) this.dom.padMedidas.classList.remove('is-valid', 'is-invalid');
                this.ui.resetAppForm();
                this.ui.resetAppForm();
                this.ui.renderCurrentApps(); // Renderiza la lista vacía

                // Reiniciar colores de validación
                this.logic.initFieldValidation();
            },

            /**
             * Resetea el formulario de login.
             */
            resetLoginForm() {
                if (this.dom.loginForm) this.dom.loginForm.reset();
                if (this.dom.loginMessage) this.ui.showStatus(this.dom.loginMessage, "", false, 1); // Limpia mensajes
            },

            /**
             * Habilita o deshabilita los botones de acción del formulario principal.
             * @param {boolean} isDisabled True para deshabilitar, false para habilitar.
             */
            setFormActionsDisabled(isDisabled) {
                if (this.dom.savePadBtn) this.dom.savePadBtn.disabled = isDisabled;
                if (this.dom.deletePadBtn) this.dom.deletePadBtn.disabled = isDisabled;
                if (this.dom.duplicatePadBtn) this.dom.duplicatePadBtn.disabled = isDisabled;
            },

            /**
             * Actualiza las estadísticas del dashboard.
             */
            updateDashboardStats() {
                this.state.totalAppsInList = this.logic.calculateTotalApps();
                if (this.dom.padCountDashboard) {
                    this.dom.padCountDashboard.textContent = Array.isArray(this.state.allPadsCache) ? this.state.allPadsCache.length : 0;
                }
                if (this.dom.appsTotalDashboard) {
                    this.dom.appsTotalDashboard.textContent = this.state.totalAppsInList;
                }
            },

            /**
             * Muestra un mensaje de estado temporal.
             */
            showStatus(element, message, isError = false, duration = 4000) {
                if (!element) return;
                element.textContent = message;
                element.className = 'status-message';
                element.classList.add(isError ? 'error' : 'success');
                if (element.timeoutId) clearTimeout(element.timeoutId);
                element.timeoutId = setTimeout(() => {
                    if (element) {
                        element.textContent = '';
                        element.className = 'status-message';
                        delete element.timeoutId;
                    }
                }, duration);
            },

            /**
             * Renderiza la lista de aplicaciones actuales, aplicando un filtro si se provee.
             */
            renderCurrentApps(filter = "") {
                if (!this.dom.currentAppsList) return;
                const filterLower = filter.toLowerCase();
                const filteredApps = this.state.currentApps.filter(app => {
                    const appString = `${app.marca || ''} ${app.serie || ''} ${app.litros || ''} ${app.año || ''} ${app.especificacion || ''}`.toLowerCase();
                    return appString.includes(filterLower);
                });

                if (filteredApps.length === 0) {
                    if (this.state.currentApps.length > 0 && filter) {
                        this.dom.currentAppsList.innerHTML = `<li class="empty-list">No hay coincidencias para "${filter}".</li>`;
                    } else {
                        this.dom.currentAppsList.innerHTML = '<li class="empty-list">Ninguna todavía</li>';
                    }
                    return;
                }

                this.dom.currentAppsList.innerHTML = filteredApps.map((app) => {
                    const originalIndex = this.state.currentApps.findIndex(originalApp => originalApp === app);
                    const marca = app?.marca || '';
                    const serie = app?.serie || '';
                    const litros = app?.litros || '';
                    const anio = app?.año || '';
                    const espec = app?.especificacion || '';
                    const details = [litros, anio, espec].filter(Boolean).join(' | ');
                    return `
                        <li>
                            <div class="app-info">
                                <strong>${marca} ${serie}</strong>
                                ${details ? `<span class="app-details">${details}</span>` : ''}
                            </div>
                            <div class="app-actions">
                                <button type="button" class="app-action-btn edit-app-btn" data-index="${originalIndex}" title="Editar App">
                                    <span class="material-icons-outlined">edit</span>
                                </button>
                                <button type="button" class="app-action-btn remove-app-btn" data-index="${originalIndex}" title="Eliminar App">
                                    <span class="material-icons-outlined">delete_forever</span>
                                </button>
                            </div>
                        </li>`;
                }).join('');
            },

            /**
             * Carga los datos de una aplicación en el formulario para edición.
             */
            loadAppDataIntoForm(index) {
                if (!Array.isArray(this.state.currentApps) || index < 0 || index >= this.state.currentApps.length) return;
                const app = this.state.currentApps[index];
                if (!app) return;

                this.state.editingAppIndex = index;
                if (this.dom.editingAppIndexInput) this.dom.editingAppIndexInput.value = index;
                if (this.dom.appMarca) this.dom.appMarca.value = app.marca || '';
                if (this.dom.appSerie) this.dom.appSerie.value = app.serie || '';
                if (this.dom.appLitros) this.dom.appLitros.value = app.litros || '';
                if (this.dom.appAnio) this.dom.appAnio.value = app.año || '';
                if (this.dom.appEspec) this.dom.appEspec.value = app.especificacion || '';

                if (this.dom.appAnio) this.logic.validateField(this.dom.appAnio, this.config.anioRegex);
                if (this.dom.appMarca) this.logic.updateSerieDatalist(app.marca || "");

                if (this.dom.addAppButtonText) this.dom.addAppButtonText.textContent = "Actualizar App";
                if (this.dom.addUpdateAppBtn) {
                    this.dom.addUpdateAppBtn.classList.remove('btn-tertiary');
                    this.dom.addUpdateAppBtn.classList.add('btn-primary');
                }
                if (this.dom.cancelEditAppBtn) this.dom.cancelEditAppBtn.style.display = 'inline-flex';
                if (this.dom.appFormDescription) this.dom.appFormDescription.textContent = `Editando: ${app.marca || ''} ${app.serie || ''}`;
                if (this.dom.appMarca) this.dom.appMarca.focus();

                // Actualizar colores
                this.logic.initFieldValidation();
            },

            /**
             * Carga los datos de una pastilla (por ID) en el formulario principal.
             */
            loadPadDataIntoForms(docId) {
                const padData = this.state.allPadsCache.find(p => p.id === docId);
                if (!padData) {
                    console.error("No se encontró la pastilla en el cache con ID:", docId);
                    return;
                }

                // Hacemos una copia profunda para la comparación
                this.state.originalPadSnapshot = JSON.parse(JSON.stringify(padData));

                this.state.currentEditingId = docId;
                if (this.dom.padRef) this.dom.padRef.value = (Array.isArray(padData.ref) ? padData.ref : []).join(', ');
                if (this.dom.padOem) this.dom.padOem.value = (Array.isArray(padData.oem) ? padData.oem : []).join(', ');
                if (this.dom.padFmsi) this.dom.padFmsi.value = (Array.isArray(padData.fmsi) ? padData.fmsi : []).join(', ');
                if (this.dom.padPosicion) this.dom.padPosicion.value = padData.posición || 'Delantera';

                if (this.dom.padMedidas) {
                    if (typeof padData.medidas === 'string') this.dom.padMedidas.value = padData.medidas || '';
                    else if (Array.isArray(padData.medidas)) this.dom.padMedidas.value = padData.medidas.join(', ');
                    else this.dom.padMedidas.value = '';
                }
                if (this.dom.padMedidas) this.logic.validateField(this.dom.padMedidas, this.config.medidasRegex);

                if (this.dom.padImagenes) this.dom.padImagenes.value = (Array.isArray(padData.imagenes) ? padData.imagenes : []).join(', ');
                this.ui.renderImagePreview();

                this.state.currentApps = Array.isArray(padData.aplicaciones) ? JSON.parse(JSON.stringify(padData.aplicaciones)) : [];

                const firstRefId = (Array.isArray(padData.ref) && padData.ref.length > 0) ? padData.ref[0] : '';
                if (this.dom.formModeTitle) this.dom.formModeTitle.textContent = `Editando Pastilla: ${firstRefId}`;
                if (this.dom.saveButtonText) this.dom.saveButtonText.textContent = "Actualizar Pastilla";
                if (this.dom.savePadBtn) {
                    this.dom.savePadBtn.classList.remove('btn-danger', 'btn-secondary');
                    this.dom.savePadBtn.classList.add('btn-primary');
                }
                if (this.dom.deletePadBtn) this.dom.deletePadBtn.style.display = 'inline-flex';
                if (this.dom.duplicatePadBtn) this.dom.duplicatePadBtn.style.display = 'inline-flex';
                if (this.dom.clearSearchBtn) this.dom.clearSearchBtn.style.display = 'inline-flex';
                if (this.dom.searchResults) this.dom.searchResults.innerHTML = '';

                this.ui.renderCurrentApps();
                this.ui.resetAppForm();
                this.ui.setActiveSection('dashboard');
                if (this.dom.padRef) this.dom.padRef.focus();

                // Actualizar colores con los datos cargados
                this.logic.initFieldValidation();
            },

            /**
             * Crea un efecto "ripple" en los botones.
             */
            createRippleEffect(event) {
                const button = event.currentTarget;
                if (!button || typeof button.getBoundingClientRect !== 'function') return;
                const circle = document.createElement('span');
                const diameter = Math.max(button.clientWidth, button.clientHeight);
                const radius = diameter / 2;
                const rect = button.getBoundingClientRect();
                circle.style.width = circle.style.height = `${diameter}px`;
                const rippleX = event.clientX - rect.left - radius;
                const rippleY = event.clientY - rect.top - radius;
                circle.style.left = `${rippleX}px`;
                circle.style.top = `${rippleY}px`;
                circle.classList.add('ripple');
                const existingRipple = button.querySelector('.ripple');
                if (existingRipple) existingRipple.remove();
                button.insertBefore(circle, button.firstChild);
                circle.addEventListener('animationend', () => { if (circle.parentNode) circle.remove(); }, { once: true });
            },

            /**
             * Renderiza el log de historial en la tabla. (VERSIÓN MEJORADA 2.10)
             */
            renderHistoryLog(historyDocs) {
                if (!this.dom.historyLogTableBody) return;
                if (historyDocs.length === 0) {
                    this.dom.historyLogTableBody.innerHTML = `
                        <tr class="empty-row-placeholder">
                            <td colspan="4">No hay historial de cambios todavía.</td>
                        </tr>`; // <-- Colspan es 4
                    return;
                }
                let html = '';
                historyDocs.forEach(doc => {
                    const data = doc.data();
                    let fechaFormateada = 'Procesando...';
                    if (data.timestamp && typeof data.timestamp.toDate === 'function') {
                        fechaFormateada = data.timestamp.toDate().toLocaleString('es-ES', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                        });
                    }

                    // --- ⬇️ LÓGICA MEJORADA AQUÍ (v2.10) ⬇️ ---
                    const emailCompleto = data.usuarioEmail || 'N/A';
                    const nombreUsuario = emailCompleto.split('@')[0];
                    // --- ⬆️ FIN DE LA LÓGICA ⬆️ ---

                    const accionClass = `log-action-${data.accion.replace(/ \(/g, '-').replace(')', '')}`;
                    let accionTexto = data.accion;

                    html += `
                        <tr>
                            <td>${nombreUsuario}</td>
                            <td><span class="log-action ${accionClass}">${accionTexto}</span></td>
                            <td>${data.padId || 'N/A'}</td>
                            <td>${fechaFormateada}</td>
                        </tr>
                    `;
                });
                this.dom.historyLogTableBody.innerHTML = html;
            },

            /**
             * Actualiza el indicador visual de conexión a Firebase.
             */
            setConnectionStatus(isSuccess, message) {
                if (!this.dom.connectionStatus || !this.dom.connectionStatusText) return;
                const icon = this.dom.connectionStatus.querySelector('.material-icons-outlined');
                if (!icon) return;
                this.dom.connectionStatus.classList.remove('status-loading', 'status-success', 'status-error');
                if (isSuccess === true) {
                    this.dom.connectionStatus.classList.add('status-success');
                    icon.textContent = 'check_circle';
                } else if (isSuccess === false) {
                    this.dom.connectionStatus.classList.add('status-error');
                    icon.textContent = 'error';
                } else {
                    this.dom.connectionStatus.classList.add('status-loading');
                    icon.textContent = 'sync';
                }
                this.dom.connectionStatusText.textContent = message;
            },
        },

        // =============================================
        // FUNCIONES DE LÓGICA DE NEGOCIO
        // =============================================
        logic: {
            /**
             * Valida un campo de texto contra una expresión regular.
             * @returns {boolean} True si es válido (o vacío), false si no.
             */
            validateField(element, regex) {
                if (!element) return false;
                const value = element.value.trim();
                if (value === "") {
                    element.classList.remove('is-valid', 'is-invalid');
                    return true; // Vacío es válido
                }
                if (regex.test(value)) {
                    element.classList.add('is-valid');
                    element.classList.remove('is-invalid');
                    return true;
                } else {
                    element.classList.add('is-invalid');
                    element.classList.remove('is-valid');
                    return false;
                }
            },

            /**
             * Actualiza visualmente el campo (Rojo si vacío, Verde si lleno).
             */
            updateFieldVisuals(element) {
                if (!element) return;
                // Ignorar campos de búsqueda o filtros si se desea, o aplicarlo a todo.
                // Aquí lo aplicamos a inputs dentro de formularios principales.
                const value = element.value.trim();
                if (value === "") {
                    element.classList.add('field-empty');
                    element.classList.remove('field-filled');
                } else {
                    element.classList.add('field-filled');
                    element.classList.remove('field-empty');
                }
            },

            /**
             * Inicializa la validación visual en todos los inputs relevantes.
             */
            initFieldValidation() {
                const forms = [this.dom.padFormMain, this.dom.appForm];
                forms.forEach(form => {
                    if (!form) return;
                    const inputs = form.querySelectorAll('input:not([type="hidden"]), select, textarea');
                    inputs.forEach(input => {
                        // Estado inicial
                        this.logic.updateFieldVisuals(input);
                        // Listeners
                        input.addEventListener('input', () => this.logic.updateFieldVisuals(input));
                        input.addEventListener('change', () => this.logic.updateFieldVisuals(input));
                    });
                });
            },

            /**
             * Genera la estructura de datos para autocompletado.
             */
            generateAutocompleteData(pads) {
                this.state.autocompleteData = {};
                if (!Array.isArray(pads)) return;
                for (const pad of pads) {
                    if (Array.isArray(pad.aplicaciones)) {
                        for (const app of pad.aplicaciones) {
                            const marca = (app.marca || "").trim();
                            const serie = (app.serie || "").trim();
                            if (marca) {
                                if (!this.state.autocompleteData[marca]) {
                                    this.state.autocompleteData[marca] = new Set();
                                }
                                if (serie) {
                                    this.state.autocompleteData[marca].add(serie);
                                }
                            }
                        }
                    }
                }
            },

            /**
             * Actualiza el datalist de marcas.
             */
            updateMarcaDatalist() {
                if (!this.dom.marcasList) return;
                const marcas = Object.keys(this.state.autocompleteData).sort();
                this.dom.marcasList.innerHTML = marcas.map(marca => `<option value="${marca}"></option>`).join('');
            },

            /**
             * Actualiza el datalist de series basado en la marca seleccionada.
             */
            updateSerieDatalist(selectedMarca) {
                if (!this.dom.seriesList) return;
                this.dom.seriesList.innerHTML = '';
                const marcaData = this.state.autocompleteData[selectedMarca];
                if (marcaData && marcaData.size > 0) {
                    const series = Array.from(marcaData).sort();
                    this.dom.seriesList.innerHTML = series.map(serie => `<option value="${serie}"></option>`).join('');
                }
            },

            /**
             * Ejecuta la búsqueda optimizada usando índices.
             */
            performSearch() {
                if (!this.dom.searchRef || !this.dom.searchType || !this.dom.searchResults) return;
                const query = this.dom.searchRef.value.trim().toLowerCase();
                const searchType = this.dom.searchType.value;

                if (query.length < 2) {
                    this.dom.searchResults.innerHTML = '<div class="search-feedback error">Escribe al menos 2 caracteres.</div>';
                    if (query.length === 0) this.dom.searchResults.innerHTML = '';
                    return;
                }

                if (!Array.isArray(this.state.allPadsCache) || this.state.allPadsCache.length === 0) {
                    this.dom.searchResults.innerHTML = '<div class="search-feedback error">La base de datos está vacía.</div>';
                    return;
                }

                try {
                    const results = [];
                    const seenPadIds = new Set();

                    // Seleccionar el índice apropiado
                    let searchIndex;
                    switch (searchType) {
                        case 'ref': searchIndex = this.state.searchIndexes.ref; break;
                        case 'fmsi': searchIndex = this.state.searchIndexes.fmsi; break;
                        case 'oem': searchIndex = this.state.searchIndexes.oem; break;
                        case 'app': searchIndex = this.state.searchIndexes.app; break;
                        default: searchIndex = new Map();
                    }

                    // Búsqueda optimizada en el índice
                    for (const [key, matches] of searchIndex.entries()) {
                        if (key.includes(query)) {
                            matches.forEach(match => {
                                if (!seenPadIds.has(match.padId)) {
                                    seenPadIds.add(match.padId);
                                    const pad = this.state.allPadsCache.find(p => p.id === match.padId);
                                    if (pad) {
                                        results.push({
                                            pad,
                                            docId: match.padId,
                                            foundText: match.value
                                        });
                                    }
                                }
                            });
                        }
                    }

                    // Limitar resultados para performance
                    const maxResults = 50;
                    const limitedResults = results.slice(0, maxResults);

                    if (limitedResults.length === 0) {
                        this.dom.searchResults.innerHTML = `<div class="search-feedback">No se encontró nada para "${this.logic.standardizeText(query, 'none')}".</div>`;
                    } else {
                        const moreText = results.length > maxResults ? `<div class="search-feedback">Mostrando ${maxResults} de ${results.length} resultados. Refina tu búsqueda.</div>` : '';
                        this.dom.searchResults.innerHTML = moreText + limitedResults.map(r => `
                            <div class="search-result-item">
                                <div>
                                    <span class="search-result-match">${r.foundText}</span>
                                    <span class="search-result-context">(${searchType.toUpperCase()} / ${r.pad.ref[0] || 'N/A'})</span>
                                </div>
                                <button type="button" class="btn btn-secondary edit-btn" data-id="${r.docId}">Cargar</button>
                            </div>
                        `).join('');
                    }
                } catch (error) {
                    console.error('Error en búsqueda:', error);
                    this.dom.searchResults.innerHTML = '<div class="search-feedback error">Error al realizar la búsqueda. Intenta de nuevo.</div>';
                }
            },

            /**
             * Calcula el número total de aplicaciones en todo el cache.
             */
            calculateTotalApps() {
                if (!Array.isArray(this.state.allPadsCache)) return 0;
                return this.state.allPadsCache.reduce((total, pad) => {
                    const appsLength = (pad && Array.isArray(pad.aplicaciones)) ? pad.aplicaciones.length : 0;
                    return total + appsLength;
                }, 0);
            },

            /**
             * Helper para iniciar la descarga de un Blob.
             */
            downloadBlob(blob, filename) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            },

            /**
             * Exporta el cache completo a un archivo JSON.
             */
            exportToJSON() {
                if (this.state.allPadsCache.length === 0) {
                    this.ui.showStatus(this.dom.connectionStatusText, "No hay datos para exportar.", true, 3000);
                    return;
                }
                try {
                    const jsonData = JSON.stringify(this.state.allPadsCache, null, 2);
                    const blob = new Blob([jsonData], { type: 'application/json' });
                    this.logic.downloadBlob(blob, `brakeX_export_${new Date().toISOString().split('T')[0]}.json`);
                    if (this.dom.connectionStatusText) this.ui.showStatus(this.dom.connectionStatusText, "Exportación JSON exitosa.", false, 3000);
                } catch (error) {
                    console.error("Error al exportar JSON:", error);
                    if (this.dom.connectionStatusText) this.ui.showStatus(this.dom.connectionStatusText, "Error al generar el JSON.", true, 3000);
                }
            },

            /**
             * Exporta los datos a un archivo Excel (XLSX) con dos pestañas.
             */
            exportToExcel() {
                if (this.state.allPadsCache.length === 0) {
                    if (this.dom.connectionStatusText) this.ui.showStatus(this.dom.connectionStatusText, "No hay datos para exportar.", true, 3000);
                    return;
                }
                if (typeof XLSX === 'undefined') {
                    console.error("La librería XLSX (SheetJS) no está cargada.");
                    if (this.dom.connectionStatusText) this.ui.showStatus(this.dom.connectionStatusText, "Error: La librería de exportación no cargó. Refresca la página.", true, 5000);
                    return;
                }
                try {
                    const padsData = this.state.allPadsCache.map(pad => ({
                        id: pad.id,
                        ref: (pad.ref || []).join(', '),
                        oem: (pad.oem || []).join(', '),
                        fmsi: (pad.fmsi || []).join(', '),
                        posicion: pad.posición || '',
                        medidas: (pad.medidas || []).join(', '),
                        imagenes: (pad.imagenes || []).join(', '),
                        num_apps: (pad.aplicaciones || []).length
                    }));
                    const appsData = [];
                    this.state.allPadsCache.forEach(pad => {
                        if (Array.isArray(pad.aplicaciones)) {
                            pad.aplicaciones.forEach(app => {
                                appsData.push({
                                    pad_id: pad.id,
                                    marca: app.marca || '',
                                    serie: app.serie || '',
                                    litros: app.litros || '',
                                    año: app.año || '',
                                    especificacion: app.especificacion || ''
                                });
                            });
                        }
                    });
                    const wsPads = XLSX.utils.json_to_sheet(padsData);
                    const wsApps = XLSX.utils.json_to_sheet(appsData);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, wsPads, "Pastillas");
                    XLSX.utils.book_append_sheet(wb, wsApps, "Aplicaciones");
                    XLSX.writeFile(wb, `brakeX_export_${new Date().toISOString().split('T')[0]}.xlsx`);
                    if (this.dom.connectionStatusText) this.ui.showStatus(this.dom.connectionStatusText, "Exportación Excel exitosa.", false, 3000);
                } catch (error) {
                    console.error("Error al exportar Excel:", error);
                    if (this.dom.connectionStatusText) this.ui.showStatus(this.dom.connectionStatusText, "Error al generar el archivo Excel.", true, 3000);
                }
            },

            /**
             * Estandariza un string a un formato específico.
             */
            standardizeText(text, type = 'none') {
                if (typeof text !== 'string' || !text) return '';
                // Limitar longitud para seguridad
                text = text.substring(0, this.config.MAX_STRING_LENGTH);
                switch (type) {
                    case 'title':
                        return text.toLowerCase()
                            .split(' ')
                            .map(s => s.charAt(0).toUpperCase() + s.substring(1))
                            .join(' ');
                    case 'upper':
                        return text.toUpperCase();
                    case 'none':
                    default:
                        return text;
                }
            },

            /**
             * Parsea y estandariza una lista separada por comas.
             */
            parseAndStandardize(value, type = 'none') {
                if (!value) return [];
                return value.split(',')
                    .map(s => this.logic.standardizeText(s.trim(), type))
                    .filter(Boolean)
                    .slice(0, this.config.MAX_ARRAY_LENGTH);
            },

            /**
             * Parsea una lista simple separada por comas.
             */
            parseList(value) {
                if (!value) return [];
                return value.split(',')
                    .map(s => s.trim())
                    .filter(Boolean)
                    .slice(0, this.config.MAX_ARRAY_LENGTH);
            },

            /**
             * Valida y sanitiza URLs de imágenes.
             */
            validateImageUrls(urls) {
                if (!Array.isArray(urls)) return [];
                return urls.filter(url => {
                    if (!url || typeof url !== 'string') return false;
                    // Validar formato básico de URL
                    return this.config.urlRegex.test(url);
                });
            },

            /**
             * Crea un objeto de pastilla desde el formulario.
             */
            createPadObjectFromForm() {
                const imagenes = this.logic.parseList(this.dom.padImagenes?.value);
                // Leer posición del input hidden creado por los toggle buttons
                const posicionInput = document.getElementById('pad-posicion-value');
                const posicion = posicionInput ? posicionInput.value : 'Delantera';

                return {
                    ref: this.logic.parseAndStandardize(this.dom.padRef?.value, 'none'),
                    oem: this.logic.parseAndStandardize(this.dom.padOem?.value, 'none'),
                    fmsi: this.logic.parseAndStandardize(this.dom.padFmsi?.value, 'none'),
                    posición: posicion,
                    medidas: this.logic.parseList(this.dom.padMedidas?.value),
                    imagenes: this.logic.validateImageUrls(imagenes),
                    aplicaciones: Array.isArray(this.state.currentApps) ? [...this.state.currentApps] : []
                };
            },

            /**
             * Verifica si el formulario tiene cambios sin guardar.
             * @returns {boolean} True si hay cambios, false si no.
             */
            isFormDirty() {
                const snapshot = this.state.originalPadSnapshot;
                if (!snapshot) return false;

                try {
                    const currentFormData = this.logic.createPadObjectFromForm();
                    const snapshotData = {
                        ref: (snapshot.ref || []).map(s => this.logic.standardizeText(s, 'none')),
                        oem: (snapshot.oem || []).map(s => this.logic.standardizeText(s, 'none')),
                        fmsi: (snapshot.fmsi || []).map(s => this.logic.standardizeText(s, 'none')),
                        posición: snapshot.posición || 'Delantera',
                        medidas: snapshot.medidas || [],
                        imagenes: snapshot.imagenes || [],
                        aplicaciones: snapshot.aplicaciones || []
                    };

                    return JSON.stringify(currentFormData) !== JSON.stringify(snapshotData);
                } catch (e) {
                    console.error("Error en isFormDirty:", e);
                    return true;
                }
            },

            /**
             * Construye índices de búsqueda para optimización.
             */
            buildSearchIndexes(pads) {
                if (!Array.isArray(pads)) return;

                // Limpiar índices existentes
                this.state.searchIndexes.ref.clear();
                this.state.searchIndexes.fmsi.clear();
                this.state.searchIndexes.oem.clear();
                this.state.searchIndexes.app.clear();

                pads.forEach(pad => {
                    const padId = pad.id;

                    // Indexar referencias
                    (pad.ref || []).forEach(ref => {
                        const key = ref.toLowerCase();
                        if (!this.state.searchIndexes.ref.has(key)) {
                            this.state.searchIndexes.ref.set(key, []);
                        }
                        this.state.searchIndexes.ref.get(key).push({ padId, value: ref });
                    });

                    // Indexar FMSI
                    (pad.fmsi || []).forEach(fmsi => {
                        const key = fmsi.toLowerCase();
                        if (!this.state.searchIndexes.fmsi.has(key)) {
                            this.state.searchIndexes.fmsi.set(key, []);
                        }
                        this.state.searchIndexes.fmsi.get(key).push({ padId, value: fmsi });
                    });

                    // Indexar OEM
                    (pad.oem || []).forEach(oem => {
                        const key = oem.toLowerCase();
                        if (!this.state.searchIndexes.oem.has(key)) {
                            this.state.searchIndexes.oem.set(key, []);
                        }
                        this.state.searchIndexes.oem.get(key).push({ padId, value: oem });
                    });

                    // Indexar aplicaciones
                    (pad.aplicaciones || []).forEach(app => {
                        const marca = (app.marca || '').toLowerCase();
                        const serie = (app.serie || '').toLowerCase();
                        const combined = `${marca} ${serie}`.trim();

                        if (combined) {
                            if (!this.state.searchIndexes.app.has(combined)) {
                                this.state.searchIndexes.app.set(combined, []);
                            }
                            this.state.searchIndexes.app.get(combined).push({
                                padId,
                                value: `${app.marca || ''} ${app.serie || ''}`.trim()
                            });
                        }
                    });
                });

                console.log('Índices de búsqueda construidos:', {
                    refs: this.state.searchIndexes.ref.size,
                    fmsi: this.state.searchIndexes.fmsi.size,
                    oem: this.state.searchIndexes.oem.size,
                    apps: this.state.searchIndexes.app.size
                });
            }
        },

        // =============================================
        // FUNCIONES DE API (FIREBASE)
        // =============================================
        api: {
            /**
             * Maneja el envío del formulario de login.
             */
            async handleLogin(e) {
                e.preventDefault();
                if (!this.dom.loginEmail || !this.dom.loginPassword || !this.dom.loginBtn || !this.dom.loginMessage) return;

                await this.api.setupSessionPersistence();

                const email = this.dom.loginEmail.value.trim();
                const password = this.dom.loginPassword.value;

                // Validación básica
                if (!email || !password) {
                    this.ui.showStatus(this.dom.loginMessage, "Por favor completa todos los campos.", true, 3000);
                    return;
                }

                // Validación de email
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    this.ui.showStatus(this.dom.loginMessage, "Por favor ingresa un email válido.", true, 3000);
                    this.dom.loginEmail.focus();
                    return;
                }

                // Activar estado de carga
                this.dom.loginBtn.disabled = true;
                this.dom.loginBtn.classList.add('loading');
                this.ui.showStatus(this.dom.loginMessage, "Conectando...", false, 10000);

                try {
                    await signInWithEmailAndPassword(auth, email, password);

                    // Guardar email si "Recordarme" está marcado
                    const rememberCheckbox = document.getElementById('login-remember');
                    if (rememberCheckbox && rememberCheckbox.checked) {
                        try {
                            localStorage.setItem('rememberedEmail', email);
                        } catch (storageError) {
                            console.warn("No se pudo guardar el email:", storageError);
                        }
                    } else {
                        try {
                            localStorage.removeItem('rememberedEmail');
                        } catch (storageError) {
                            console.warn("No se pudo eliminar el email guardado:", storageError);
                        }
                    }

                    this.ui.showStatus(this.dom.loginMessage, "¡Inicio de sesión exitoso!", false, 2000);

                    // Animación de salida suave
                    setTimeout(() => {
                        if (this.dom.loginContainer) {
                            this.dom.loginContainer.classList.add('fade-out');
                        }
                    }, 500);

                } catch (error) {
                    console.error("Error de inicio de sesión:", error.code, error.message);

                    // Mensajes de error específicos
                    let errorMessage = "Error al iniciar sesión. Intenta de nuevo.";
                    switch (error.code) {
                        case 'auth/invalid-email':
                            errorMessage = "El formato del email es inválido.";
                            break;
                        case 'auth/user-disabled':
                            errorMessage = "Esta cuenta ha sido deshabilitada.";
                            break;
                        case 'auth/user-not-found':
                            errorMessage = "No existe una cuenta con este email.";
                            break;
                        case 'auth/wrong-password':
                            errorMessage = "Contraseña incorrecta.";
                            break;
                        case 'auth/invalid-credential':
                            errorMessage = "Credenciales inválidas. Verifica tu email y contraseña.";
                            break;
                        case 'auth/too-many-requests':
                            errorMessage = "Demasiados intentos fallidos. Intenta más tarde.";
                            break;
                        case 'auth/network-request-failed':
                            errorMessage = "Error de conexión. Verifica tu internet.";
                            break;
                    }

                    this.ui.showStatus(this.dom.loginMessage, errorMessage, true, 5000);

                    // Animación de shake en el formulario
                    if (this.dom.loginForm) {
                        this.dom.loginForm.classList.add('error-animation');
                        setTimeout(() => {
                            this.dom.loginForm.classList.remove('error-animation');
                        }, 500);
                    }
                } finally {
                    this.dom.loginBtn.disabled = false;
                    this.dom.loginBtn.classList.remove('loading');
                }
            },

            /**
             * Maneja el clic en el botón de logout.
             */
            async handleLogout() {
                const confirmed = await this.ui.showCustomConfirm("¿Estás seguro de que quieres cerrar sesión?", "Cerrar Sesión", "Cerrar Sesión", "btn-danger");
                if (confirmed) {
                    try {
                        await signOut(auth);
                    } catch (error) {
                        console.error("Error al cerrar sesión:", error);
                    }
                }
            },

            /**
             * Cierra la sesión forzadamente (ej. por inactividad).
             */
            async forceLogout(message) {
                try {
                    await signOut(auth);
                    if (this.dom.loginMessage) this.ui.showStatus(this.dom.loginMessage, message, false, 5000);
                } catch (error) {
                    console.error("Error al forzar cierre de sesión:", error);
                }
            },

            /**
             * Configura la persistencia de la sesión de Firebase.
             */
            async setupSessionPersistence() {
                try {
                    await setPersistence(auth, browserSessionPersistence);
                    console.log("Persistencia de sesión configurada a browserSessionPersistence.");
                } catch (error) {
                    console.error("Error al configurar la persistencia de Firebase:", error);
                }
            },

            /**
             * Guarda o actualiza una pastilla en Firestore.
             */
            async savePad() {
                // Validación de medidas
                if (this.dom.padMedidas && !this.logic.validateField(this.dom.padMedidas, this.config.medidasRegex)) {
                    if (this.dom.savePadStatus) this.ui.showStatus(this.dom.savePadStatus, "El formato de Medidas es incorrecto. Debe ser '100 x 50'.", true, 5000);
                    this.dom.padMedidas.focus();
                    return;
                }

                // Crear objeto usando el helper
                const newPad = this.logic.createPadObjectFromForm();

                // Validación de referencia obligatoria
                if (newPad.ref.length === 0) {
                    if (this.dom.savePadStatus) this.ui.showStatus(this.dom.savePadStatus, "La Referencia (ID) es obligatoria.", true);
                    if (this.dom.padRef) this.dom.padRef.focus();
                    return;
                }

                // Validación adicional de longitud de ID
                const docId = newPad.ref[0];
                if (docId.length > 100) {
                    if (this.dom.savePadStatus) this.ui.showStatus(this.dom.savePadStatus, "La Referencia es demasiado larga (máx 100 caracteres).", true);
                    if (this.dom.padRef) this.dom.padRef.focus();
                    return;
                }

                if (this.dom.savePadStatus) this.ui.showStatus(this.dom.savePadStatus, "Guardando en Firebase...", false, 10000);
                this.ui.setFormActionsDisabled(true);

                let message = "";
                let accionLog = "Crear";

                try {
                    if (this.state.currentEditingId && this.state.currentEditingId !== docId) {
                        const oldDocRef = doc(db, "pastillas", this.state.currentEditingId);
                        await deleteDoc(oldDocRef);
                        this.api.logHistory("Eliminar (Movido)", this.state.currentEditingId);
                        message = `¡Pastilla movida de "${this.state.currentEditingId}" a "${docId}"!`;
                        accionLog = "Crear (Movido)";
                    } else if (this.state.currentEditingId) {
                        message = `¡Pastilla "${docId}" actualizada!`;
                        accionLog = "Actualizar";
                    } else {
                        message = `¡Pastilla "${docId}" creada!`;
                        accionLog = "Crear";
                    }

                    const newDocRef = doc(db, "pastillas", docId);
                    await setDoc(newDocRef, newPad);
                    this.api.logHistory(accionLog, docId);

                    this.ui.resetFormsAndMode();
                    this.ui.setActiveSection('dashboard');
                    if (this.dom.connectionStatusText) this.ui.showStatus(this.dom.connectionStatusText, message, false);

                } catch (err) {
                    console.error("Error guardando en Firebase:", err);
                    const errorMsg = err.code === 'permission-denied'
                        ? 'Error: No tienes permisos para guardar.'
                        : `Error de Firebase: ${err.message}`;
                    if (this.dom.savePadStatus) this.ui.showStatus(this.dom.savePadStatus, errorMsg, true, 6000);
                } finally {
                    this.ui.setFormActionsDisabled(false);
                }
            },

            /**
             * Elimina la pastilla actualmente cargada de Firestore.
             */
            async deletePad() {
                if (!this.state.currentEditingId) {
                    if (this.dom.savePadStatus) this.ui.showStatus(this.dom.savePadStatus, "No hay pastilla válida cargada para eliminar.", true);
                    return;
                }

                const refId = this.state.currentEditingId;
                const message = `¿Estás SEGURO de eliminar la pastilla "${refId}"? Esta acción es permanente.`;
                const confirmed = await this.ui.showCustomConfirm(message, "Eliminar Pastilla", "Sí, Eliminar", "btn-danger");

                if (confirmed) {
                    if (this.dom.savePadStatus) this.ui.showStatus(this.dom.savePadStatus, "Eliminando de Firebase...", false, 10000);

                    this.ui.setFormActionsDisabled(true); // Bloquea botones

                    try {
                        const docRef = doc(db, "pastillas", refId);
                        await deleteDoc(docRef);
                        this.api.logHistory("Eliminar", refId);
                        if (this.dom.connectionStatusText) this.ui.showStatus(this.dom.connectionStatusText, `Pastilla "${refId}" eliminada.`, false);

                        this.ui.resetFormsAndMode(); // Esto limpia el snapshot
                        this.ui.setActiveSection('dashboard');
                    } catch (err) {
                        console.error("Error eliminando de Firebase:", err);
                        if (this.dom.savePadStatus) this.ui.showStatus(this.dom.savePadStatus, `Error de Firebase: ${err.message}`, true, 6000);
                    } finally {
                        this.ui.setFormActionsDisabled(false); // Desbloquea botones
                    }
                }
            },

            /**
             * Registra una acción en el historial de Firestore.
             */
            async logHistory(accion, padId) {
                try {
                    const user = auth.currentUser;
                    if (!user) {
                        console.warn("Intento de log sin usuario autenticado.");
                        return;
                    }
                    const historyCollection = collection(db, "historial");
                    await addDoc(historyCollection, {
                        usuarioEmail: user.email,
                        accion: accion,
                        padId: padId,
                        timestamp: serverTimestamp()
                    });
                } catch (error) {
                    console.error("Error al escribir en el historial:", error);
                }
            },

            /**
             * Inicializa el listener de estado de autenticación.
             */
            initFirebase() {
                try {
                    onAuthStateChanged(auth, (user) => {
                        if (user && !user.isAnonymous) {
                            // --- Usuario AUTENTICADO ---
                            console.log("Usuario autenticado:", user.uid, user.email);
                            if (this.dom.mainAppContainer) this.dom.mainAppContainer.style.display = 'block';
                            if (this.dom.floatingBtnContainer) this.dom.floatingBtnContainer.style.display = 'block';
                            if (this.dom.loginContainer) this.dom.loginContainer.style.display = 'none';
                            this.initInactivityLogout(); // Iniciar temporizador de inactividad
                            this.api.loadDataFromFirebase();
                        } else {
                            // --- Usuario NO autenticado ---
                            console.log("Usuario no logueado.");
                            if (this.dom.mainAppContainer) this.dom.mainAppContainer.style.display = 'none';
                            if (this.dom.floatingBtnContainer) this.dom.floatingBtnContainer.style.display = 'none';
                            if (this.dom.loginContainer) this.dom.loginContainer.style.display = 'flex';

                            // Detener temporizador y limpiar datos
                            if (this.state.inactivityTimer) clearTimeout(this.state.inactivityTimer);
                            this.state.inactivityTimer = null;
                            this.state.allPadsCache = [];
                            this.state.currentApps = [];

                            this.ui.resetLoginForm(); // ¡Limpia el formulario de login!
                            if (this.dom.loginContainer) this.dom.loginContainer.classList.remove('fade-out'); // FIX: Asegurar que sea visible
                            this.ui.resetFormsAndMode();
                            this.ui.updateDashboardStats();
                        }
                    });
                } catch (err) {
                    console.error("Error inicializando Firebase Auth:", err);
                    if (this.dom.loginMessage) this.ui.showStatus(this.dom.loginMessage, `Error: ${err.message}`, true, 10000);
                }
            },

            /**
             * Carga los datos (Pastillas e Historial) desde Firestore.
             */
            loadDataFromFirebase() {
                // 1. Cargar Pastillas
                const padsCollection = collection(db, "pastillas");
                onSnapshot(padsCollection, (snapshot) => {
                    console.log("Datos recibidos de Firestore (pastillas).");
                    this.state.allPadsCache = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    this.state.allPadsCache.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));

                    // Construir índices de búsqueda
                    this.logic.buildSearchIndexes(this.state.allPadsCache);

                    this.ui.updateDashboardStats();
                    this.logic.generateAutocompleteData(this.state.allPadsCache);
                    this.logic.updateMarcaDatalist();
                    this.ui.setConnectionStatus(true, `Conectado: ${this.state.allPadsCache.length} pastillas cargadas.`);

                }, (error) => {
                    console.error("Error al escuchar datos de Firestore:", error);
                    if (error.code === 'permission-denied') {
                        this.ui.setConnectionStatus(false, `Error: Permiso denegado. Revisa las reglas de Firestore.`);
                    } else {
                        this.ui.setConnectionStatus(false, `Error de Base de Datos: ${error.message}`);
                    }
                });

                // 2. Cargar Historial
                try {
                    const historyCollection = collection(db, "historial");
                    const historyQuery = query(historyCollection, orderBy("timestamp", "desc"), limit(50));
                    onSnapshot(historyQuery, (snapshot) => {
                        console.log("Datos de historial recibidos.");
                        this.ui.renderHistoryLog(snapshot.docs);
                    }, (error) => {
                        console.error("Error al cargar el historial:", error);
                        if (this.dom.historyLogTableBody) {
                            this.dom.historyLogTableBody.innerHTML = `
                                <tr class="empty-row-placeholder">
                                    <td colspan="4">Error al cargar el historial: ${error.message}</td>
                                </tr>`;
                        }
                    });
                } catch (error) {
                    console.error("Error al configurar el listener de historial:", error);
                }
            },
        },

        // =============================================
        // MANEJADORES DE EVENTOS
        // =============================================
        /**
         * Centraliza la asignación de todos los event listeners.
         */
        initEventListeners() {
            try {
                // --- Login/Logout ---
                if (this.dom.loginForm) this.dom.loginForm.addEventListener('submit', this.api.handleLogin.bind(this));
                if (this.dom.logoutBtn) this.dom.logoutBtn.addEventListener('click', this.api.handleLogout.bind(this));
                if (this.dom.themeToggleLogin) this.dom.themeToggleLogin.addEventListener('click', this.handleDarkModeToggle.bind(this));
                if (this.dom.loginPasswordToggle) this.dom.loginPasswordToggle.addEventListener('click', this.handlePasswordToggle.bind(this));

                // --- Modales ---
                if (this.dom.confirmModalBtnYes) this.dom.confirmModalBtnYes.addEventListener('click', () => this.ui.hideCustomConfirm(true));
                if (this.dom.confirmModalBtnNo) this.dom.confirmModalBtnNo.addEventListener('click', () => this.ui.hideCustomConfirm(false));
                if (this.dom.confirmModalOverlay) this.dom.confirmModalOverlay.addEventListener('click', (e) => {
                    if (e.target === this.dom.confirmModalOverlay) this.ui.hideCustomConfirm(false);
                });

                // --- Navegación ---
                if (this.dom.navItems) this.dom.navItems.forEach(item => {
                    item.addEventListener('click', async (e) => { // ¡Convertido a async!
                        e.preventDefault();
                        const section = item.dataset?.section;
                        if (!section) return;

                        // 1. Comprobar si estamos en 'dashboard' (donde está el form) y si el form está "sucio"
                        const activeSectionEl = document.querySelector('.content-section.active');
                        const isLeavingEdit = (activeSectionEl && activeSectionEl.id === 'dashboard');
                        const isTargetEdit = section === 'dashboard';

                        // Solo chequear si salimos de 'dashboard' hacia OTRA sección
                        if (isLeavingEdit && !isTargetEdit && this.logic.isFormDirty()) {
                            const confirmed = await this.ui.showCustomConfirm(
                                "Tienes cambios sin guardar. ¿Estás seguro de que quieres salir y descartarlos?",
                                "Cambios sin Guardar",
                                "Descartar Cambios",
                                "btn-danger"
                            );

                            // Si el usuario cancela (confirmed = false), no hacemos nada
                            if (!confirmed) return;
                        }

                        // Si no está "sucio" o si el usuario confirmó
                        this.ui.setActiveSection(section);

                        // Si el usuario salió de "dashboard", reseteamos el formulario
                        if (isLeavingEdit && !isTargetEdit) {
                            this.ui.resetFormsAndMode();
                        }
                    });
                });

                // --- Exportación ---
                if (this.dom.exportJsonBtn) this.dom.exportJsonBtn.addEventListener('click', this.logic.exportToJSON.bind(this));
                if (this.dom.exportExcelBtn) this.dom.exportExcelBtn.addEventListener('click', this.logic.exportToExcel.bind(this));

                // --- Búsqueda ---
                if (this.dom.searchBtn) this.dom.searchBtn.addEventListener('click', this.logic.performSearch.bind(this));
                if (this.dom.searchType) this.dom.searchType.addEventListener('change', this.ui.updateSearchPlaceholder.bind(this));
                if (this.dom.searchRef) {
                    this.dom.searchRef.addEventListener('input', this.handleSearchInput.bind(this));
                    this.dom.searchRef.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') { e.preventDefault(); clearTimeout(this.state.searchTimeout); this.logic.performSearch(); }
                    });
                }
                if (this.dom.searchResults) this.dom.searchResults.addEventListener('click', this.handleSearchResultsClick.bind(this));
                if (this.dom.clearSearchBtn) this.dom.clearSearchBtn.addEventListener('click', this.ui.resetFormsAndMode.bind(this));

                // --- Formulario de Aplicaciones ---
                if (this.dom.appForm) this.dom.appForm.addEventListener('submit', this.handleAppFormSubmit.bind(this));
                if (this.dom.cancelEditAppBtn) this.dom.cancelEditAppBtn.addEventListener('click', this.ui.resetAppForm.bind(this));
                if (this.dom.currentAppsList) this.dom.currentAppsList.addEventListener('click', this.handleAppListClick.bind(this));
                if (this.dom.filterAppsInput) {
                    this.dom.filterAppsInput.addEventListener('input', () => {
                        this.ui.renderCurrentApps(this.dom.filterAppsInput.value);
                    });
                }

                // --- Formulario Principal (Pad) ---
                if (this.dom.savePadBtn) this.dom.savePadBtn.addEventListener('click', this.api.savePad.bind(this));
                if (this.dom.deletePadBtn) this.dom.deletePadBtn.addEventListener('click', this.api.deletePad.bind(this));
                if (this.dom.duplicatePadBtn) this.dom.duplicatePadBtn.addEventListener('click', this.handleDuplicatePad.bind(this));

                // --- Validaciones y Previsualización ---
                if (this.dom.padImagenes) {
                    this.dom.padImagenes.addEventListener('input', () => {
                        clearTimeout(this.state.imagePreviewTimeout);
                        this.state.imagePreviewTimeout = setTimeout(() => this.ui.renderImagePreview(), 300);
                    });
                }
                if (this.dom.appMarca) {
                    this.dom.appMarca.addEventListener('input', () => this.logic.updateSerieDatalist(this.dom.appMarca.value.trim()));
                }
                if (this.dom.appAnio) {
                    this.dom.appAnio.addEventListener('input', () => this.logic.validateField(this.dom.appAnio, this.config.anioRegex));
                }
                if (this.dom.padMedidas) {
                    this.dom.padMedidas.addEventListener('input', () => this.logic.validateField(this.dom.padMedidas, this.config.medidasRegex));
                }

                // --- Modo Oscuro ---
                if (this.dom.darkBtn) {
                    this.dom.darkBtn.addEventListener('click', this.handleDarkModeToggle.bind(this));
                }

                console.log("Todos los event listeners configurados.");
            } catch (error) {
                console.error("Error crítico añadiendo listeners:", error);
            }
        },

        // --- Handlers específicos (para limpiar initEventListeners) ---

        handlePasswordToggle() {
            const input = this.dom.loginPassword;
            const icon = this.dom.loginPasswordToggle.querySelector('span.material-icons-outlined');
            if (input.type === "password") {
                input.type = "text";
                icon.textContent = "visibility_off";
                this.dom.loginPasswordToggle.setAttribute('aria-label', 'Ocultar contraseña');
            } else {
                input.type = "password";
                icon.textContent = "visibility";
                this.dom.loginPasswordToggle.setAttribute('aria-label', 'Mostrar contraseña');
            }
        },

        handleSearchInput() {
            clearTimeout(this.state.searchTimeout);
            const query = this.dom.searchRef.value.trim();
            if (query === "") {
                if (this.dom.searchResults) this.dom.searchResults.innerHTML = '';
                return;
            }
            this.state.searchTimeout = setTimeout(() => this.logic.performSearch(), 300);
        },

        handleSearchResultsClick(e) {
            const targetButton = e.target.closest('.edit-btn');
            if (targetButton) {
                const docId = targetButton.dataset.id;
                if (docId) {
                    this.ui.loadPadDataIntoForms(docId);
                }
            }
        },

        handleAppFormSubmit(e) {
            e.preventDefault();
            if (this.dom.appAnio && !this.logic.validateField(this.dom.appAnio, this.config.anioRegex)) {
                if (this.dom.savePadStatus) this.ui.showStatus(this.dom.savePadStatus, "El formato del Año de la aplicación es incorrecto.", true, 3000);
                this.dom.appAnio.focus();
                return;
            }

            const app = {
                marca: this.logic.standardizeText(this.dom.appMarca.value.trim(), 'none'),
                serie: this.logic.standardizeText(this.dom.appSerie.value.trim(), 'none'),
                litros: this.dom.appLitros?.value.trim() || '',
                año: this.dom.appAnio?.value.trim() || '',
                especificacion: this.dom.appEspec?.value.trim() || '',
            };

            if (!app.marca || !app.serie) {
                if (this.dom.savePadStatus) this.ui.showStatus(this.dom.savePadStatus, "Marca y Serie son obligatorios para la aplicación.", true, 3000);
                if (this.dom.appMarca && !app.marca) this.dom.appMarca.focus(); else if (this.dom.appSerie) this.dom.appSerie.focus();
                return;
            }

            if (!Array.isArray(this.state.currentApps)) this.state.currentApps = [];

            if (this.state.editingAppIndex > -1 && this.state.editingAppIndex < this.state.currentApps.length) {
                this.state.currentApps[this.state.editingAppIndex] = app;
            } else {
                this.state.currentApps.push(app);
            }

            this.ui.renderCurrentApps(this.dom.filterAppsInput?.value || ""); // Re-renderizar con filtro
            this.ui.resetAppForm();
            if (this.dom.appMarca) this.dom.appMarca.focus();
        },

        async handleAppListClick(e) {
            const button = e.target.closest('.app-action-btn');
            if (!button) return;
            const indexStr = button.dataset.index;
            if (!indexStr) return;
            const index = parseInt(indexStr, 10);
            if (isNaN(index) || !Array.isArray(this.state.currentApps) || index < 0 || index >= this.state.currentApps.length) return;

            if (button.classList.contains('edit-app-btn')) {
                this.ui.loadAppDataIntoForm(index);
            } else if (button.classList.contains('remove-app-btn')) {
                const appToRemove = this.state.currentApps[index];
                const message = `¿Seguro que quieres eliminar la aplicación "${appToRemove.marca || ''} ${appToRemove.serie || ''}"?`;
                const confirmed = await this.ui.showCustomConfirm(message, "Eliminar Aplicación", "Eliminar", "btn-danger");

                if (confirmed) {
                    this.state.currentApps.splice(index, 1);
                    this.ui.renderCurrentApps(this.dom.filterAppsInput?.value || ""); // Re-renderizar con filtro

                    if (this.state.editingAppIndex === index) {
                        this.ui.resetAppForm();
                    } else if (this.state.editingAppIndex > index) {
                        this.state.editingAppIndex--;
                        if (this.dom.editingAppIndexInput) this.dom.editingAppIndexInput.value = this.state.editingAppIndex;
                    }
                }
            }
        },

        handleDuplicatePad() {
            if (!this.state.currentEditingId) {
                if (this.dom.savePadStatus) this.ui.showStatus(this.dom.savePadStatus, "Carga una pastilla primero para duplicarla.", true);
                return;
            }

            this.state.currentEditingId = null; // Clave para que se guarde como nueva
            this.state.originalPadSnapshot = null; // Esto ya no es una "edición"

            const firstRefId = this.dom.padRef.value.split(',')[0].trim() || 'pastilla';
            if (this.dom.formModeTitle) this.dom.formModeTitle.textContent = `Duplicando: ${firstRefId}`;
            if (this.dom.saveButtonText) this.dom.saveButtonText.textContent = "Guardar como Nueva";
            if (this.dom.deletePadBtn) this.dom.deletePadBtn.style.display = 'none';
            if (this.dom.duplicatePadBtn) this.dom.duplicatePadBtn.style.display = 'none';
            if (this.dom.savePadBtn) {
                this.dom.savePadBtn.classList.remove('btn-danger', 'btn-secondary');
                this.dom.savePadBtn.classList.add('btn-primary');
            }
            if (this.dom.padRef) this.dom.padRef.focus();
            if (this.dom.savePadStatus) this.ui.showStatus(this.dom.savePadStatus, "Modo 'Duplicar' activado. Cambia la 'Ref' y guarda.", false, 6000);
        },

        handleDarkModeToggle(e) {
            this.ui.createRippleEffect(e);
            const isDark = document.body.classList.toggle('lp-dark');
            this.dom.darkBtn?.setAttribute('aria-pressed', String(isDark));
            this.dom.themeToggleLogin?.setAttribute('aria-pressed', String(isDark));

            const iconAnimation = (icon, isShowing) => {
                if (!icon) return;
                icon.style.transition = 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out';
                icon.style.opacity = isShowing ? '1' : '0';
                icon.style.transform = isShowing ? 'scale(1)' : 'scale(0.8)';
            };

            // Animate main app icons
            iconAnimation(this.dom.sunIcon, !isDark);
            iconAnimation(this.dom.moonIcon, isDark);

            // Animate login theme toggle icons
            if (this.dom.themeToggleLogin) {
                const loginSunIcon = this.dom.themeToggleLogin.querySelector('.lp-icon-sun');
                const loginMoonIcon = this.dom.themeToggleLogin.querySelector('.lp-icon-moon');
                iconAnimation(loginSunIcon, !isDark);
                iconAnimation(loginMoonIcon, isDark);
            }

            try { localStorage.setItem('darkModeAdminPref', isDark ? '1' : '0'); }
            catch (storageError) { console.warn("No se pudo guardar pref modo oscuro:", storageError); }
        },

        // =============================================
        // LÓGICA DE SESIÓN E INACTIVIDAD
        // =============================================
        /**
         * Inicializa el chequeo de inactividad.
         */
        initInactivityLogout() {
            document.addEventListener('mousemove', this.resetInactivityTimer.bind(this));
            document.addEventListener('keypress', this.resetInactivityTimer.bind(this));
            document.addEventListener('click', this.resetInactivityTimer.bind(this));
            document.addEventListener('scroll', this.resetInactivityTimer.bind(this));
            this.resetInactivityTimer(); // Iniciar el temporizador
        },

        /**
         * Reinicia el temporizador de inactividad.
         */
        resetInactivityTimer() {
            if (this.state.inactivityTimer) clearTimeout(this.state.inactivityTimer);
            this.state.inactivityTimer = setTimeout(() => {
                this.api.forceLogout("Sesión cerrada por inactividad (15 minutos). Por favor, ingresa de nuevo.");
            }, this.config.INACTIVITY_DURATION);
        },

        // =============================================
        // LÓGICA DE INICIO (MODO OSCURO)
        // =============================================
        /**
         * Aplica el modo oscuro al cargar la página.
         */
        initDarkMode() {
            try {
                const savedPref = localStorage.getItem('darkModeAdminPref');
                const prefersDarkScheme = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
                let startDark = (savedPref === '1') || (savedPref === null && prefersDarkScheme);

                if (startDark) document.body.classList.add('lp-dark');
                else document.body.classList.remove('lp-dark');

                if (this.dom.darkBtn) this.dom.darkBtn.setAttribute('aria-pressed', String(startDark));
                if (this.dom.themeToggleLogin) this.dom.themeToggleLogin.setAttribute('aria-pressed', String(startDark));

                const initialIconAnimation = (icon, isShowing) => {
                    if (!icon) return;
                    icon.style.transition = 'none';
                    icon.style.opacity = isShowing ? '1' : '0';
                    icon.style.transform = isShowing ? 'scale(1)' : 'scale(0.8)';
                };

                // Icons for main app dark button
                initialIconAnimation(this.dom.sunIcon, !startDark);
                initialIconAnimation(this.dom.moonIcon, startDark);

                // Icons for login theme toggle
                if (this.dom.themeToggleLogin) {
                    const loginSunIcon = this.dom.themeToggleLogin.querySelector('.lp-icon-sun');
                    const loginMoonIcon = this.dom.themeToggleLogin.querySelector('.lp-icon-moon');
                    initialIconAnimation(loginSunIcon, !startDark);
                    initialIconAnimation(loginMoonIcon, startDark);
                }

                requestAnimationFrame(() => {
                    if (this.dom.sunIcon) this.dom.sunIcon.style.transition = '';
                    if (this.dom.moonIcon) this.dom.moonIcon.style.transition = '';
                    if (this.dom.themeToggleLogin) {
                        const loginSunIcon = this.dom.themeToggleLogin.querySelector('.lp-icon-sun');
                        const loginMoonIcon = this.dom.themeToggleLogin.querySelector('.lp-icon-moon');
                        if (loginSunIcon) loginSunIcon.style.transition = '';
                        if (loginMoonIcon) loginMoonIcon.style.transition = '';
                    }
                });
            } catch (storageError) { console.warn("No se pudo aplicar pref modo oscuro:", storageError); }
        },

        /**
         * Inicializa la funcionalidad "Recordarme" cargando el email guardado.
         */
        initRememberMe() {
            try {
                const rememberedEmail = localStorage.getItem('rememberedEmail');
                if (rememberedEmail && this.dom.loginEmail) {
                    this.dom.loginEmail.value = rememberedEmail;
                    const rememberCheckbox = document.getElementById('login-remember');
                    if (rememberCheckbox) {
                        rememberCheckbox.checked = true;
                    }
                    // Auto-focus en el campo de contraseña si hay email guardado
                    if (this.dom.loginPassword) {
                        this.dom.loginPassword.focus();
                    }
                }
            } catch (storageError) {
                console.warn("No se pudo cargar email guardado:", storageError);
            }
        },

        /**
         * Maneja el toggle de visibilidad de contraseña.
         */
        handlePasswordToggle() {
            if (!this.dom.loginPassword || !this.dom.loginPasswordToggle) return;

            const icon = this.dom.loginPasswordToggle.querySelector('.material-icons-outlined');
            if (!icon) return;

            if (this.dom.loginPassword.type === 'password') {
                this.dom.loginPassword.type = 'text';
                icon.textContent = 'visibility_off';
                this.dom.loginPasswordToggle.setAttribute('aria-label', 'Ocultar contraseña');
            } else {
                this.dom.loginPassword.type = 'password';
                icon.textContent = 'visibility';
                this.dom.loginPasswordToggle.setAttribute('aria-label', 'Mostrar contraseña');
            }
        },

    }; // Fin del objeto AdminPanel

    // --- Bindeo de contexto ---
    // Asegura que 'this' dentro de las funciones de ui, logic, y api
    // siempre se refiera al objeto AdminPanel principal.
    const bindContext = (obj) => {
        for (const key in obj) {
            if (typeof obj[key] === 'function') {
                obj[key] = obj[key].bind(AdminPanel);
            }
        }
    };

    bindContext(AdminPanel.ui);
    bindContext(AdminPanel.logic);
    bindContext(AdminPanel.api);

    // --- Iniciar la aplicación ---
    AdminPanel.init();

}); // Fin DOMContentLoaded
