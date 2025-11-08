// Este script debe ser cargado como type="module" en el HTML
// --- Importar herramientas de Firebase (expuestas en 'window' desde el HTML) ---
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
    console.log("Admin script 2.6 (Filter & Standardize) loaded. DOM ready.");
    // ----- VARIABLES GLOBALES -----
    let allPadsCache = []; 
    let currentApps = [];
    let currentEditingId = null; 
    let editingAppIndex = -1;
    let totalAppsInList = 0;
    let autocompleteData = {}; 
    let imagePreviewTimeout; 
    let searchTimeout; 
    let inactivityTimer; // Temporizador de inactividad
    const INACTIVITY_DURATION = 15 * 60 * 1000; // 15 minutos en milisegundos
    // --- Expresiones Regulares para Validación ---
    const anioRegex = /^(?:(\d{2}|\d{4})(?:-(\d{2}|\d{4}))?)$/; // Ej: 99 o 1999 o 99-05 o 1999-2005
    const medidasRegex = /^\d+(\.\d+)?\s*x\s*\d+(\.\d+)?(,\s*\d+(\.\d+)?\s*x\s*\d+(\.\d+)?)*$/; // Ej: 100 x 50 o 100 x 50, 110.5 x 60
    // ----- DOM ELEMENTS -----
    let els = {};
    try {
        console.log("Attempting to obtain DOM elements...");
        // Función auxiliar para obtener elementos o devolver null
        const getEl = id => document.getElementById(id);
        els = {
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
            // --- NUEVO: Filtro de Aplicaciones ---
            filterAppsInput: getEl('filter-apps-input'),
            // --- ✅ Elementos del VIN (nuevos) ---
            vinLookupBtn: getEl('vin-lookup-btn'),
            vinModalOverlay: getEl('vin-modal-overlay'),
            vinInput: getEl('vin-input'),
            vinForm: getEl('vin-form'),
            vinFeedback: getEl('vin-feedback'),
            vinSubmitBtn: getEl('vin-submit-btn'),
            vinCancelBtn: getEl('vin-cancel-btn')
        };
        // Verificación ESENCIAL (Menos estricta)
        // Solo revisa los contenedores principales y el botón de dark mode
        // Los otros se revisan con 'if (els.element)' antes de usarse.
        if (!els.loginContainer || !els.mainAppContainer || !els.pageTitle || !els.darkBtn) {
             throw new Error("Elementos esenciales (Contenedores principales) del layout o formulario no encontrados.");
        }
        console.log("DOM elements obtained successfully.");
    } catch (error) {
        console.error("Error obtaining DOM elements:", error);
        console.error("Error crítico: No se encontraron elementos HTML necesarios. Revisa IDs.");
        return; // Detener la ejecución si los contenedores base no existen
    }

    // --- ✅ FUNCIÓN DE BÚSQUEDA POR VIN ---
    const lookupVIN = async () => {
        const { vinModalOverlay, vinInput, vinForm, vinFeedback, vinSubmitBtn, vinCancelBtn } = els;
        if (!vinModalOverlay || !vinInput || !vinForm || !vinFeedback || !vinSubmitBtn || !vinCancelBtn) {
            showStatus(els.savePadStatus, "Error: Modal de VIN no encontrado.", true, 5000);
            return;
        }

        vinInput.value = '';
        vinFeedback.textContent = '';
        vinFeedback.className = 'status-message';
        vinInput.classList.remove('is-valid', 'is-invalid');
        vinSubmitBtn.disabled = true;
        vinModalOverlay.style.display = 'flex';
        setTimeout(() => vinModalOverlay.classList.add('visible'), 10);
        vinInput.focus();

        let vinValue = null;
        const close = (value = null) => {
            vinModalOverlay.classList.remove('visible');
            setTimeout(() => {
                vinModalOverlay.style.display = 'none';
                vinValue = value;
            }, 200);
        };

        const validate = () => {
            const v = vinInput.value.trim();
            if (v.length === 17) {
                vinInput.classList.add('is-valid');
                vinInput.classList.remove('is-invalid');
                vinSubmitBtn.disabled = false;
                return true;
            } else {
                vinInput.classList.add('is-invalid');
                vinInput.classList.remove('is-valid');
                vinSubmitBtn.disabled = true;
                return false;
            }
        };

        const handleInput = () => validate();
        const handleKeyPress = (e) => {
            if (e.key === 'Enter' && validate()) {
                e.preventDefault();
                vinForm.dispatchEvent(new Event('submit'));
            }
        };
        const handleSubmit = (e) => {
            e.preventDefault();
            if (validate()) close(vinInput.value.trim());
        };
        const handleCancel = () => close();
        const handleOverlayClick = (e) => {
            if (e.target === vinModalOverlay) close();
        };

        vinInput.addEventListener('input', handleInput);
        vinInput.addEventListener('keypress', handleKeyPress);
        vinForm.addEventListener('submit', handleSubmit);
        vinCancelBtn.addEventListener('click', handleCancel);
        vinModalOverlay.addEventListener('click', handleOverlayClick);

        // Esperar cierre
        while (vinValue === null) {
            await new Promise(r => setTimeout(r, 100));
        }
        if (!vinValue) return;

        showStatus(els.savePadStatus, "Buscando datos del VIN...", false, 10000);

        try {
            const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vinValue)}?format=json`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (!data.Results?.[0]) throw new Error("VIN no encontrado o inválido");

            const r = data.Results[0];
            const marca = standardizeText(r.Make || '', 'title');
            const serie = standardizeText(r.Model || '', 'title');
            const año = r.ModelYear || '';
            const motor = (r.DisplacementL && r.DisplacementL !== '0')
                ? `${r.DisplacementL}L`
                : (r.EngineCylinders && r.EngineCylinders !== '0')
                    ? `${r.EngineCylinders} Cil.`
                    : '';

            if (els.appMarca) els.appMarca.value = marca;
            if (els.appSerie) els.appSerie.value = serie;
            if (els.appAnio) {
                els.appAnio.value = año;
                validateField(els.appAnio, anioRegex);
            }
            if (els.appLitros) els.appLitros.value = motor;
            if (marca) updateSerieDatalist(marca);

            showStatus(els.savePadStatus, `VIN cargado: ${marca} ${serie} (${año})`, false, 5000);
            if (els.appSerie) els.appSerie.focus();

        } catch (err) {
            console.error("Error en búsqueda VIN:", err);
            showStatus(els.savePadStatus, `Error: ${err.message || 'No se pudo conectar.'}`, true, 6000);
        }
    };

    // --- Modal de Confirmación ---
    let confirmResolve = null;
    const showCustomConfirm = (message, title = "Confirmar Acción", confirmText = "Confirmar", confirmClass = "btn-danger") => {
        if (!els.confirmModalOverlay) return Promise.resolve(false); 
        els.confirmModalTitle.textContent = title;
        els.confirmModalMessage.textContent = message;
        els.confirmModalBtnYes.textContent = confirmText;
        els.confirmModalBtnYes.className = 'btn';
        els.confirmModalBtnYes.classList.add(confirmClass);
        els.confirmModalOverlay.style.display = 'flex';
        setTimeout(() => els.confirmModalOverlay.classList.add('visible'), 10);
        return new Promise((resolve) => { confirmResolve = resolve; });
    };
    const hideCustomConfirm = (result) => {
        if (!els.confirmModalOverlay) return;
        els.confirmModalOverlay.classList.remove('visible');
        setTimeout(() => {
             els.confirmModalOverlay.style.display = 'none';
             if (confirmResolve) { confirmResolve(result); confirmResolve = null; }
        }, 200); 
    };
    // --- Navegación ---
    const setActiveSection = (sectionId) => {
        if (!sectionId || typeof sectionId !== 'string' || !els.contentSections || !els.navItems) return;
        els.contentSections.forEach(section => section.classList.remove('active'));
        els.navItems.forEach(item => {
            if (item.dataset && typeof item.dataset.section !== 'undefined') {
                item.classList.toggle('active', item.dataset.section === sectionId);
            }
        });
        const activeSection = document.getElementById(sectionId);
        if (activeSection) {
            activeSection.classList.add('active');
            const navItem = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
            if (els.pageTitle && navItem) {
                const titleSpan = navItem.querySelector('span:last-child');
                if (titleSpan) els.pageTitle.textContent = titleSpan.textContent || 'Admin Panel';
            }
        } else {
            console.error(`Sección con ID '${sectionId}' no encontrada. Volviendo a dashboard.`);
            if (sectionId !== 'dashboard') setActiveSection('dashboard'); // Evitar bucle infinito
        }
    };
    // --- Previsualización de Imágenes ---
    const renderImagePreview = () => {
        if (!els.imagePreviewContainer || !els.padImagenes) return;
        const imageUrls = els.padImagenes.value.split(',').map(url => url.trim()).filter(Boolean);
        els.imagePreviewContainer.innerHTML = ''; 
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
            els.imagePreviewContainer.appendChild(wrapper);
        });
    };
    // --- Validación de Campos ---
    const validateField = (element, regex) => {
        if (!element) return false;
        const value = element.value.trim();
        if (value === "") { 
            element.classList.remove('is-valid', 'is-invalid');
            return true; // Vacío es válido (no requerido)
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
    };
    // --- Autocompletado ---
    const generateAutocompleteData = (pads) => {
        autocompleteData = {};
        if (!Array.isArray(pads)) return;
        for (const pad of pads) {
            if (Array.isArray(pad.aplicaciones)) {
                for (const app of pad.aplicaciones) {
                    const marca = (app.marca || "").trim();
                    const serie = (app.serie || "").trim();
                    if (marca) {
                        if (!autocompleteData[marca]) {
                            autocompleteData[marca] = new Set();
                        }
                        if (serie) {
                            autocompleteData[marca].add(serie);
                        }
                    }
                }
            }
        }
    };
    const updateMarcaDatalist = () => {
        if (!els.marcasList) return;
        const marcas = Object.keys(autocompleteData).sort();
        els.marcasList.innerHTML = marcas.map(marca => `<option value="${marca}"></option>`).join('');
    };
    const updateSerieDatalist = (selectedMarca) => {
        if (!els.seriesList) return;
        els.seriesList.innerHTML = ''; 
        const marcaData = autocompleteData[selectedMarca];
        if (marcaData && marcaData.size > 0) {
            const series = Array.from(marcaData).sort();
            els.seriesList.innerHTML = series.map(serie => `<option value="${serie}"></option>`).join('');
        }
    };
    // --- BÚSQUEDA ---
    const updateSearchPlaceholder = () => {
        if (!els.searchType || !els.searchRef) return;
        const type = els.searchType.value;
        switch(type) {
            case 'ref': els.searchRef.placeholder = "Ej: 7104INC"; break;
            case 'fmsi': els.searchRef.placeholder = "Ej: D1047"; break;
            case 'oem': els.searchRef.placeholder = "Ej: 123456789"; break;
            case 'app': els.searchRef.placeholder = "Ej: Chevrolet Spark"; break;
        }
    };
    const performSearch = () => {
        if (!els.searchRef || !els.searchType || !els.searchResults) return;
        const query = els.searchRef.value.trim().toLowerCase();
        const searchType = els.searchType.value;
        if (query.length < 2) { 
            els.searchResults.innerHTML = '<div class="search-feedback error">Escribe al menos 2 caracteres.</div>';
            if (query.length === 0) els.searchResults.innerHTML = '';
            return;
        }
        if (!Array.isArray(allPadsCache) || allPadsCache.length === 0) {
            els.searchResults.innerHTML = '<div class="search-feedback error">La base de datos está vacía.</div>';
            return;
        }
        const results = allPadsCache.reduce((acc, pad) => { 
            let foundMatch = null;
            try {
                switch(searchType) {
                    case 'ref': foundMatch = (pad.ref || []).find(r => r.toLowerCase().includes(query)); break;
                    case 'fmsi': foundMatch = (pad.fmsi || []).find(f => f.toLowerCase().includes(query)); break;
                    case 'oem': foundMatch = (pad.oem || []).find(o => o.toLowerCase().includes(query)); break;
                    case 'app':
                        const foundApp = (pad.aplicaciones || []).find(app => 
                            (app.marca && app.marca.toLowerCase().includes(query)) || 
                            (app.serie && app.serie.toLowerCase().includes(query))
                        );
                        if (foundApp) { foundMatch = `${foundApp.marca} ${foundApp.serie}`; }
                        break;
                }
            } catch (e) { console.error("Error buscando en pastilla:", e, pad); }
             if (foundMatch) {
                 acc.push({ pad, docId: pad.id, foundText: foundMatch }); 
             }
             return acc;
        }, []); 
        if (results.length === 0) {
            els.searchResults.innerHTML = `<div class="search-feedback">No se encontró nada para "${query}".</div>`;
        } else {
            els.searchResults.innerHTML = results.map(r => `
                <div class="search-result-item">
                    <div>
                        <span class="search-result-match">${r.foundText}</span>
                        <span class="search-result-context">(${searchType.toUpperCase()} / ${r.pad.ref[0] || 'N/A'})</span>
                    </div>
                    <button type="button" class="btn btn-secondary edit-btn" data-id="${r.docId}">Cargar</button>
                </div>
            `).join(''); 
        }
    };
    // --- Resets de Formularios ---
    const resetAppForm = () => {
        if (els.appForm) els.appForm.reset();
        if (els.editingAppIndexInput) els.editingAppIndexInput.value = "-1";
        editingAppIndex = -1;
        if (els.addAppButtonText) els.addAppButtonText.textContent = "Añadir App";
        if (els.addUpdateAppBtn) {
            els.addUpdateAppBtn.classList.remove('btn-primary');
            els.addUpdateAppBtn.classList.add('btn-tertiary');
        }
        if (els.cancelEditAppBtn) els.cancelEditAppBtn.style.display = 'none';
        if (els.appFormDescription) els.appFormDescription.textContent = "Añade vehículos compatibles.";
        if (els.appAnio) els.appAnio.classList.remove('is-valid', 'is-invalid');
        if (els.seriesList) els.seriesList.innerHTML = '';
        if (els.filterAppsInput) els.filterAppsInput.value = ''; // Limpiar filtro
    };
    const resetFormsAndMode = () => {
        if (els.padFormMain) els.padFormMain.reset();
        currentEditingId = null; 
        currentApps = [];
        if (els.formModeTitle) els.formModeTitle.textContent = "Añadir Nueva Pastilla";
        if (els.saveButtonText) els.saveButtonText.textContent = "Guardar Pastilla";
        if (els.savePadBtn) {
            els.savePadBtn.classList.remove('btn-danger', 'btn-secondary');
            els.savePadBtn.classList.add('btn-primary');
        }
        if (els.deletePadBtn) els.deletePadBtn.style.display = 'none'; 
        if (els.duplicatePadBtn) els.duplicatePadBtn.style.display = 'none'; 
        if (els.searchRef) els.searchRef.value = '';
        if (els.searchResults) els.searchResults.innerHTML = '';
        if (els.clearSearchBtn) els.clearSearchBtn.style.display = 'none';
        if (els.imagePreviewContainer) els.imagePreviewContainer.innerHTML = ''; 
        if (els.padMedidas) els.padMedidas.classList.remove('is-valid', 'is-invalid');
        resetAppForm();
        renderCurrentApps(); // Renderiza la lista vacía
    };
    // --- Estadísticas ---
    const calculateTotalApps = () => {
        if (!Array.isArray(allPadsCache)) return 0;
        return allPadsCache.reduce((total, pad) => {
            const appsLength = (pad && Array.isArray(pad.aplicaciones)) ? pad.aplicaciones.length : 0;
            return total + appsLength;
        }, 0);
    };
    const updateDashboardStats = () => {
        totalAppsInList = calculateTotalApps();
        if (els.padCountDashboard) {
            els.padCountDashboard.textContent = Array.isArray(allPadsCache) ? allPadsCache.length : 0;
        }
        if (els.appsTotalDashboard) {
            els.appsTotalDashboard.textContent = totalAppsInList;
        }
    };
    // --- Mensajes de Estado ---
    const showStatus = (element, message, isError = false, duration = 4000) => {
        if (!element) return;
        element.textContent = message;
        element.className = 'status-message';
        element.classList.add(isError ? 'error' : 'success');
        if (element.timeoutId) clearTimeout(element.timeoutId);
        element.timeoutId = setTimeout(() => {
            if(element) {
                element.textContent = '';
                element.className = 'status-message';
                delete element.timeoutId;
            }
        }, duration);
    };
    // --- Renderizado de Lista de Apps (ACTUALIZADO CON FILTRO) ---
    const renderCurrentApps = (filter = "") => {
        if (!els.currentAppsList) return;
        const filterLower = filter.toLowerCase();
        const filteredApps = currentApps.filter(app => {
            const appString = `${app.marca || ''} ${app.serie || ''} ${app.litros || ''} ${app.año || ''} ${app.especificacion || ''}`.toLowerCase();
            return appString.includes(filterLower);
        });
        if (filteredApps.length === 0) {
            if (currentApps.length > 0 && filter) {
                els.currentAppsList.innerHTML = `<li class="empty-list">No hay coincidencias para "${filter}".</li>`;
            } else {
                els.currentAppsList.innerHTML = '<li class="empty-list">Ninguna todavía</li>';
            }
            return;
        }
        els.currentAppsList.innerHTML = filteredApps.map((app) => {
             // Encontrar el índice original en la lista 'currentApps'
            const originalIndex = currentApps.findIndex(originalApp => originalApp === app);
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
    };
    // --- Cargar Datos en Formularios ---
    const loadAppDataIntoForm = (index) => {
        if (!Array.isArray(currentApps) || index < 0 || index >= currentApps.length) return;
        const app = currentApps[index];
        if (!app) return;
        editingAppIndex = index;
        if (els.editingAppIndexInput) els.editingAppIndexInput.value = index;
        if (els.appMarca) els.appMarca.value = app.marca || '';
        if (els.appSerie) els.appSerie.value = app.serie || '';
        if (els.appLitros) els.appLitros.value = app.litros || '';
        if (els.appAnio) els.appAnio.value = app.año || '';
        if (els.appEspec) els.appEspec.value = app.especificacion || '';
        if (els.appAnio) validateField(els.appAnio, anioRegex); 
        if (els.appMarca) updateSerieDatalist(app.marca || ""); 
        if (els.addAppButtonText) els.addAppButtonText.textContent = "Actualizar App";
        if (els.addUpdateAppBtn) {
             els.addUpdateAppBtn.classList.remove('btn-tertiary');
             els.addUpdateAppBtn.classList.add('btn-primary');
        }
        if (els.cancelEditAppBtn) els.cancelEditAppBtn.style.display = 'inline-flex';
        if (els.appFormDescription) els.appFormDescription.textContent = `Editando: ${app.marca || ''} ${app.serie || ''}`;
        if (els.appMarca) els.appMarca.focus();
    };
    const loadPadDataIntoForms = (docId) => { 
        const padData = allPadsCache.find(p => p.id === docId); 
        if (!padData) {
            console.error("No se encontró la pastilla en el cache con ID:", docId);
            return;
        }
        currentEditingId = docId; 
        if (els.padRef) els.padRef.value = (Array.isArray(padData.ref) ? padData.ref : []).join(', ');
        if (els.padOem) els.padOem.value = (Array.isArray(padData.oem) ? padData.oem : []).join(', ');
        if (els.padFmsi) els.padFmsi.value = (Array.isArray(padData.fmsi) ? padData.fmsi : []).join(', ');
        if (els.padPosicion) els.padPosicion.value = padData.posición || 'Delantera';
        if (els.padMedidas) {
            if (typeof padData.medidas === 'string') els.padMedidas.value = padData.medidas || '';
            else if (Array.isArray(padData.medidas)) els.padMedidas.value = padData.medidas.join(', ');
            else els.padMedidas.value = '';
        }
        if (els.padMedidas) validateField(els.padMedidas, medidasRegex); 
        if (els.padImagenes) els.padImagenes.value = (Array.isArray(padData.imagenes) ? padData.imagenes : []).join(', ');
        renderImagePreview(); 
        currentApps = Array.isArray(padData.aplicaciones) ? JSON.parse(JSON.stringify(padData.aplicaciones)) : [];
        const firstRefId = (Array.isArray(padData.ref) && padData.ref.length > 0) ? padData.ref[0] : '';
        if (els.formModeTitle) els.formModeTitle.textContent = `Editando Pastilla: ${firstRefId}`;
        if (els.saveButtonText) els.saveButtonText.textContent = "Actualizar Pastilla";
        if (els.savePadBtn) {
            els.savePadBtn.classList.remove('btn-danger', 'btn-secondary');
            els.savePadBtn.classList.add('btn-primary');
        }
        if (els.deletePadBtn) els.deletePadBtn.style.display = 'inline-flex'; 
        if (els.duplicatePadBtn) els.duplicatePadBtn.style.display = 'inline-flex'; 
        if (els.clearSearchBtn) els.clearSearchBtn.style.display = 'inline-flex';
        if (els.searchResults) els.searchResults.innerHTML = '';
        renderCurrentApps();
        resetAppForm();
        setActiveSection('edit-pad');
        if (els.padRef) els.padRef.focus();
    };
    // --- Efecto Ripple ---
    const createRippleEffect = (event) => {
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
    };
    // --- Funciones de Exportación ---
    const downloadBlob = (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    const exportToJSON = () => {
        if (allPadsCache.length === 0) {
            showStatus(els.connectionStatusText, "No hay datos para exportar.", true, 3000);
            return;
        }
        try {
            const jsonData = JSON.stringify(allPadsCache, null, 2);
            const blob = new Blob([jsonData], { type: 'application/json' });
            downloadBlob(blob, `brakeX_export_${new Date().toISOString().split('T')[0]}.json`);
            if (els.connectionStatusText) showStatus(els.connectionStatusText, "Exportación JSON exitosa.", false, 3000);
        } catch (error) {
            console.error("Error al exportar JSON:", error);
            if (els.connectionStatusText) showStatus(els.connectionStatusText, "Error al generar el JSON.", true, 3000);
        }
    };
    const exportToExcel = () => {
        if (allPadsCache.length === 0) {
            if (els.connectionStatusText) showStatus(els.connectionStatusText, "No hay datos para exportar.", true, 3000);
            return;
        }
        if (typeof XLSX === 'undefined') {
            console.error("La librería XLSX (SheetJS) no está cargada.");
            if (els.connectionStatusText) showStatus(els.connectionStatusText, "Error: La librería de exportación no cargó. Refresca la página.", true, 5000);
            return;
        }
        try {
            const padsData = allPadsCache.map(pad => ({
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
            allPadsCache.forEach(pad => {
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
            if (els.connectionStatusText) showStatus(els.connectionStatusText, "Exportación Excel exitosa.", false, 3000);
        } catch (error) {
            console.error("Error al exportar Excel:", error);
            if (els.connectionStatusText) showStatus(els.connectionStatusText, "Error al generar el archivo Excel.", true, 3000);
        }
    };
    // --- Funciones de Historial ---
    const logHistory = async (accion, padId) => {
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
    };
    const renderHistoryLog = (historyDocs) => {
        if (!els.historyLogTableBody) return;
        if (historyDocs.length === 0) {
            els.historyLogTableBody.innerHTML = `
                <tr class="empty-row-placeholder">
                    <td colspan="4">No hay historial de cambios todavía.</td>
                </tr>`;
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
            // CORRECCIÓN: Usar guiones para nombres de clase CSS
            const accionClass = `log-action-${data.accion.replace(/ \(/g, '-').replace(')', '')}`;
            let accionTexto = data.accion;
            html += `
                <tr>
                    <td>${data.usuarioEmail || 'N/A'}</td>
                    <td><span class="log-action ${accionClass}">${accionTexto}</span></td>
                    <td>${data.padId || 'N/A'}</td>
                    <td>${fechaFormateada}</td>
                </tr>
            `;
        });
        els.historyLogTableBody.innerHTML = html;
    };
    // --- NUEVO: Función de Estandarización de Texto ---
    /**
     * Estandariza un string a un formato específico.
     * @param {string} text El texto de entrada.
     * @param {'title' | 'upper' | 'none'} type El tipo de estandarización.
     * @returns {string} El texto estandarizado.
     */
    const standardizeText = (text, type = 'none') => {
        if (typeof text !== 'string' || !text) return '';
        switch (type) {
            case 'title':
                // Convierte "ford ranger" a "Ford Ranger"
                return text.toLowerCase()
                           .split(' ')
                           .map(s => s.charAt(0).toUpperCase() + s.substring(1))
                           .join(' ');
            case 'upper':
                // Convierte "d1047" a "D1047"
                return text.toUpperCase();
            case 'none':
            default:
                return text;
        }
    };
    // --- Control de Sesión ---
    const forceLogout = async (message) => {
        try {
            await signOut(auth);
            if (els.loginMessage) showStatus(els.loginMessage, message, false, 5000);
        } catch (error) {
            console.error("Error al forzar cierre de sesión:", error);
        }
    };
    const resetInactivityTimer = () => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            forceLogout("Sesión cerrada por inactividad (15 minutos). Por favor, ingresa de nuevo.");
        }, INACTIVITY_DURATION);
    };
    const setupInactivityLogout = () => {
        // Reiniciar con cualquier interacción
        document.addEventListener('mousemove', resetInactivityTimer);
        document.addEventListener('keypress', resetInactivityTimer);
        document.addEventListener('click', resetInactivityTimer);
        document.addEventListener('scroll', resetInactivityTimer);
        resetInactivityTimer(); // Iniciar el temporizador
    };
    const setupSessionPersistence = async () => {
        try {
            // Esto asegura que la sesión solo exista en esta pestaña/ventana.
            await setPersistence(auth, browserSessionPersistence);
            console.log("Persistencia de sesión configurada a browserSessionPersistence.");
        } catch (error) {
            console.error("Error al configurar la persistencia de Firebase:", error);
        }
    };
    // ----- EVENT LISTENERS -----
    try {
        // --- Listeners de Login/Logout ---
        if (els.loginForm) {
            els.loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!els.loginEmail || !els.loginPassword || !els.loginBtn || !els.loginMessage) return;
                // Configurar persistencia ANTES de iniciar sesión
                await setupSessionPersistence(); 
                const email = els.loginEmail.value;
                const password = els.loginPassword.value;
                els.loginBtn.disabled = true;
                els.loginBtn.querySelector('span:last-child').textContent = "Ingresando...";
                showStatus(els.loginMessage, "Conectando...", false, 10000);
                try {
                    await signInWithEmailAndPassword(auth, email, password);
                    showStatus(els.loginMessage, "¡Éxito!", false, 2000);
                } catch (error) {
                    console.error("Error de inicio de sesión:", error.code, error.message);
                    showStatus(els.loginMessage, "Error: Usuario o contraseña incorrectos.", true, 5000);
                } finally {
                    els.loginBtn.disabled = false;
                    els.loginBtn.querySelector('span:last-child').textContent = "Ingresar";
                }
            });
        }
        if (els.logoutBtn) {
            els.logoutBtn.addEventListener('click', async () => {
                 const confirmed = await showCustomConfirm("¿Estás seguro de que quieres cerrar sesión?", "Cerrar Sesión", "Cerrar Sesión", "btn-danger");
                 if (confirmed) {
                     try {
                         await signOut(auth);
                     } catch (error) {
                         console.error("Error al cerrar sesión:", error);
                     }
                 }
            });
        }
        if (els.loginPasswordToggle) {
            els.loginPasswordToggle.addEventListener('click', () => {
                 const input = els.loginPassword;
                 const icon = els.loginPasswordToggle.querySelector('span.material-icons-outlined');
                 if (input.type === "password") {
                     input.type = "text";
                     icon.textContent = "visibility_off";
                     els.loginPasswordToggle.setAttribute('aria-label', 'Ocultar contraseña');
                 } else {
                     input.type = "password";
                     icon.textContent = "visibility";
                     els.loginPasswordToggle.setAttribute('aria-label', 'Mostrar contraseña');
                 }
            });
        }
        // --- Modales ---
        if (els.confirmModalBtnYes) els.confirmModalBtnYes.addEventListener('click', () => hideCustomConfirm(true));
        if (els.confirmModalBtnNo) els.confirmModalBtnNo.addEventListener('click', () => hideCustomConfirm(false));
        if (els.confirmModalOverlay) els.confirmModalOverlay.addEventListener('click', (e) => {
            if (e.target === els.confirmModalOverlay) hideCustomConfirm(false);
        });
        // --- Navegación ---
        if (els.navItems) els.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset?.section;
                if (section) setActiveSection(section);
            });
        });
        // --- Exportación ---
        if (els.exportJsonBtn) els.exportJsonBtn.addEventListener('click', exportToJSON);
        if (els.exportExcelBtn) els.exportExcelBtn.addEventListener('click', exportToExcel);
        // --- BÚSQUEDA ---
        if (els.searchBtn) els.searchBtn.addEventListener('click', performSearch);
        if (els.searchType) els.searchType.addEventListener('change', updateSearchPlaceholder); 
        if (els.searchRef) {
            els.searchRef.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                // CORRECCIÓN: Limpiar si está vacío
                const query = els.searchRef.value.trim();
                if (query === "") {
                    if (els.searchResults) els.searchResults.innerHTML = '';
                    return;
                }
                searchTimeout = setTimeout(performSearch, 300);
            });
            els.searchRef.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); clearTimeout(searchTimeout); performSearch(); }
            });
        }
        if (els.searchResults) els.searchResults.addEventListener('click', (e) => {
            const targetButton = e.target.closest('.edit-btn');
            if (targetButton) {
                const docId = targetButton.dataset.id; 
                if (docId) {
                     loadPadDataIntoForms(docId); 
                }
            }
        });
        if (els.clearSearchBtn) els.clearSearchBtn.addEventListener('click', resetFormsAndMode);
        // --- Formulario de Aplicaciones ---
        if (els.appForm) els.appForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (els.appAnio && !validateField(els.appAnio, anioRegex)) {
                 if(els.savePadStatus) showStatus(els.savePadStatus, "El formato del Año de la aplicación es incorrecto.", true, 3000);
                 els.appAnio.focus();
                 return;
            }
            const app = {
                // NUEVO: Estandarización aplicada
                marca: standardizeText(els.appMarca.value.trim(), 'title'),
                serie: standardizeText(els.appSerie.value.trim(), 'title'),
                litros: els.appLitros?.value.trim() || '',
                año: els.appAnio?.value.trim() || '',
                especificacion: els.appEspec?.value.trim() || '',
            };
            if (!app.marca || !app.serie) {
                if(els.savePadStatus) showStatus(els.savePadStatus, "Marca y Serie son obligatorios para la aplicación.", true, 3000);
                if(els.appMarca && !app.marca) els.appMarca.focus(); else if (els.appSerie) els.appSerie.focus();
                return;
            }
            if (!Array.isArray(currentApps)) currentApps = [];
            if (editingAppIndex > -1 && editingAppIndex < currentApps.length) {
                currentApps[editingAppIndex] = app;
            } else {
                currentApps.push(app);
            }
            renderCurrentApps(els.filterAppsInput?.value || ""); // Re-renderizar con filtro
            resetAppForm();
            if(els.appMarca) els.appMarca.focus();
        });
        if (els.cancelEditAppBtn) els.cancelEditAppBtn.addEventListener('click', resetAppForm);
        // Clics Lista Apps (Editar/Eliminar)
        if (els.currentAppsList) els.currentAppsList.addEventListener('click', async (e) => {
            const button = e.target.closest('.app-action-btn');
            if (!button) return;
            const indexStr = button.dataset.index;
            if (!indexStr) return;
            const index = parseInt(indexStr, 10);
            if (isNaN(index) || !Array.isArray(currentApps) || index < 0 || index >= currentApps.length) return;
            if (button.classList.contains('edit-app-btn')) {
                loadAppDataIntoForm(index);
            } else if (button.classList.contains('remove-app-btn')) {
                const appToRemove = currentApps[index];
                const message = `¿Seguro que quieres eliminar la aplicación "${appToRemove.marca || ''} ${appToRemove.serie || ''}"?`;
                const confirmed = await showCustomConfirm(message, "Eliminar Aplicación", "Eliminar", "btn-danger");
                if (confirmed) {
                    currentApps.splice(index, 1);
                    renderCurrentApps(els.filterAppsInput?.value || ""); // Re-renderizar con filtro
                    if (editingAppIndex === index) resetAppForm();
                    else if (editingAppIndex > index) {
                        editingAppIndex--; 
                        if (els.editingAppIndexInput) els.editingAppIndexInput.value = editingAppIndex;
                    }
                }
            }
        });
        // --- NUEVO: Listener para el Filtro de Aplicaciones ---
        if (els.filterAppsInput) {
            els.filterAppsInput.addEventListener('input', () => {
                renderCurrentApps(els.filterAppsInput.value);
            });
        }
        // --- GUARDAR/ACTUALIZAR PASTILLA (FIREBASE) ---
        if (els.savePadBtn) els.savePadBtn.addEventListener('click', async () => {
            if (els.padMedidas && !validateField(els.padMedidas, medidasRegex)) {
                 if(els.savePadStatus) showStatus(els.savePadStatus, "El formato de Medidas es incorrecto. Debe ser '100 x 50'.", true, 5000);
                 els.padMedidas.focus();
                 return;
            }
            // NUEVO: Estandarización aplicada
            const refsArray = (els.padRef.value || '').split(',').map(s => standardizeText(s.trim(), 'upper')).filter(Boolean);
            if (refsArray.length === 0) {
                if(els.savePadStatus) showStatus(els.savePadStatus, "La Referencia (ID) es obligatoria.", true);
                if(els.padRef) els.padRef.focus();
                return;
            }
            if(els.savePadStatus) showStatus(els.savePadStatus, "Guardando en Firebase...", false, 10000);
            const newPad = {
                ref: refsArray,
                // NUEVO: Estandarización aplicada
                oem: (els.padOem?.value || '').split(',').map(s => standardizeText(s.trim(), 'upper')).filter(Boolean),
                fmsi: (els.padFmsi?.value || '').split(',').map(s => standardizeText(s.trim(), 'upper')).filter(Boolean),
                posición: els.padPosicion?.value || 'Delantera',
                medidas: (els.padMedidas?.value || '').split(',').map(s => s.trim()).filter(Boolean),
                imagenes: (els.padImagenes?.value || '').split(',').map(s => s.trim()).filter(Boolean),
                aplicaciones: Array.isArray(currentApps) ? currentApps : [],
            };
            const docId = newPad.ref[0]; // El ID es la primera Ref, ahora en mayúsculas
            let message = "";
            let accionLog = "Crear"; 
            try {
                if (currentEditingId && currentEditingId !== docId) {
                    const oldDocRef = doc(db, "pastillas", currentEditingId);
                    await deleteDoc(oldDocRef);
                    logHistory("Eliminar (Movido)", currentEditingId); 
                    message = `¡Pastilla movida de "${currentEditingId}" a "${docId}"!`;
                    accionLog = "Crear (Movido)"; 
                } else if (currentEditingId) {
                    message = `¡Pastilla "${docId}" actualizada!`;
                    accionLog = "Actualizar"; 
                } else {
                    message = `¡Pastilla "${docId}" creada!`;
                    accionLog = "Crear"; 
                }
                const newDocRef = doc(db, "pastillas", docId);
                await setDoc(newDocRef, newPad); 
                logHistory(accionLog, docId);
                resetFormsAndMode();
                setActiveSection('dashboard');
                if(els.connectionStatusText) showStatus(els.connectionStatusText, message, false);
            } catch (err) {
                console.error("Error guardando en Firebase:", err);
                if(els.savePadStatus) showStatus(els.savePadStatus, `Error de Firebase: ${err.message}`, true, 6000);
            }
        });
        // --- ELIMINAR PASTILLA (FIREBASE) ---
        if (els.deletePadBtn) els.deletePadBtn.addEventListener('click', async () => {
            if (!currentEditingId) {
                if(els.savePadStatus) showStatus(els.savePadStatus, "No hay pastilla válida cargada para eliminar.", true);
                return;
            }
            const refId = currentEditingId;
            const message = `¿Estás SEGURO de eliminar la pastilla "${refId}"? Esta acción es permanente.`;
            const confirmed = await showCustomConfirm(message, "Eliminar Pastilla", "Sí, Eliminar", "btn-danger");
            if (confirmed) {
                if(els.savePadStatus) showStatus(els.savePadStatus, "Eliminando de Firebase...", false, 10000);
                try {
                    const docRef = doc(db, "pastillas", refId);
                    await deleteDoc(docRef);
                    logHistory("Eliminar", refId);
                    if(els.connectionStatusText) showStatus(els.connectionStatusText, `Pastilla "${refId}" eliminada.`, false);
                    resetFormsAndMode();
                    setActiveSection('dashboard');
                } catch (err) {
                    console.error("Error eliminando de Firebase:", err);
                    if(els.savePadStatus) showStatus(els.savePadStatus, `Error de Firebase: ${err.message}`, true, 6000);
                }
            }
        });
        // --- DUPLICAR PASTILLA ---
        if (els.duplicatePadBtn) els.duplicatePadBtn.addEventListener('click', () => {
            if (!currentEditingId) { 
                if(els.savePadStatus) showStatus(els.savePadStatus, "Carga una pastilla primero para duplicarla.", true);
                return;
            }
            currentEditingId = null;
            const firstRefId = els.padRef.value.split(',')[0].trim() || 'pastilla';
            if (els.formModeTitle) els.formModeTitle.textContent = `Duplicando: ${firstRefId}`;
            if (els.saveButtonText) els.saveButtonText.textContent = "Guardar como Nueva";
            if (els.deletePadBtn) els.deletePadBtn.style.display = 'none';
            if (els.duplicatePadBtn) els.duplicatePadBtn.style.display = 'none';
             if (els.savePadBtn) {
                 els.savePadBtn.classList.remove('btn-danger', 'btn-secondary');
                 els.savePadBtn.classList.add('btn-primary');
             }
            if (els.padRef) els.padRef.focus();
            if(els.savePadStatus) showStatus(els.savePadStatus, "Modo 'Duplicar' activado. Cambia la 'Ref' y guarda.", false, 6000);
        });
        // --- Validaciones y Previsualización ---
        if (els.padImagenes) {
            els.padImagenes.addEventListener('input', () => {
                clearTimeout(imagePreviewTimeout);
                imagePreviewTimeout = setTimeout(renderImagePreview, 300); 
            });
        }
        if(els.appMarca) {
            els.appMarca.addEventListener('input', () => updateSerieDatalist(els.appMarca.value.trim()));
        }
        if(els.appAnio) {
            els.appAnio.addEventListener('input', () => validateField(els.appAnio, anioRegex));
        }
        if(els.padMedidas) {
            els.padMedidas.addEventListener('input', () => validateField(els.padMedidas, medidasRegex));
        }
        // --- MODO OSCURO (Listener) ---
        if (els.darkBtn) {
            els.darkBtn.addEventListener('click', (e) => {
                 createRippleEffect(e);
                 const isDark = document.body.classList.toggle('lp-dark');
                 els.darkBtn?.setAttribute('aria-pressed', String(isDark));
                 const iconAnimation = (icon, isShowing) => {
                     if (!icon) return;
                     icon.style.transition = 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out';
                     icon.style.opacity = isShowing ? '1' : '0';
                     icon.style.transform = isShowing ? 'scale(1)' : 'scale(0.8)';
                 };
                 iconAnimation(els.sunIcon, !isDark);
                 iconAnimation(els.moonIcon, isDark);
                 try { localStorage.setItem('darkModeAdminPref', isDark ? '1' : '0'); }
                 catch (storageError) { console.warn("No se pudo guardar pref modo oscuro:", storageError); }
            });
        }

        // --- ✅ LISTENER DEL BOTÓN VIN ---
        if (els.vinLookupBtn) {
            els.vinLookupBtn.addEventListener('click', lookupVIN);
        }

        console.log("Todos los event listeners configurados.");
    } catch (error) {
        console.error("Error crítico añadiendo listeners:", error);
    }
    // ----- APLICAR DARK MODE AL CARGAR -----
    try {
        const savedPref = localStorage.getItem('darkModeAdminPref');
        const prefersDarkScheme = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
        let startDark = (savedPref === '1') || (savedPref === null && prefersDarkScheme);
        if (startDark) document.body.classList.add('lp-dark');
        else document.body.classList.remove('lp-dark');
        if(els.darkBtn) els.darkBtn.setAttribute('aria-pressed', String(startDark));
        const initialIconAnimation = (icon, isShowing) => {
             if (!icon) return;
             icon.style.transition = 'none';
             icon.style.opacity = isShowing ? '1' : '0';
             icon.style.transform = isShowing ? 'scale(1)' : 'scale(0.8)';
        };
        initialIconAnimation(els.sunIcon, !startDark);
        initialIconAnimation(els.moonIcon, startDark);
        requestAnimationFrame(() => {
             if (els.sunIcon) els.sunIcon.style.transition = '';
             if (els.moonIcon) els.moonIcon.style.transition = '';
        });
    } catch (storageError) { console.warn("No se pudo aplicar pref modo oscuro:", storageError); }
    // =============================================
    // Lógica de Inicialización de Firebase
    // =============================================
    const initFirebase = () => {
        try {
            onAuthStateChanged(auth, (user) => {
                if (user && !user.isAnonymous) {
                    // --- Usuario AUTENTICADO ---
                    console.log("Usuario autenticado:", user.uid, user.email);
                    if(els.mainAppContainer) els.mainAppContainer.style.display = 'block';
                    if(els.floatingBtnContainer) els.floatingBtnContainer.style.display = 'block';
                    if(els.loginContainer) els.loginContainer.style.display = 'none';
                    setupInactivityLogout(); // Iniciar temporizador de inactividad
                    loadDataFromFirebase();
                } else {
                    // --- Usuario NO autenticado ---
                    console.log("Usuario no logueado.");
                    if(els.mainAppContainer) els.mainAppContainer.style.display = 'none';
                    if(els.floatingBtnContainer) els.floatingBtnContainer.style.display = 'none';
                    if(els.loginContainer) els.loginContainer.style.display = 'flex';
                    // Detener temporizador y limpiar datos
                    if (inactivityTimer) clearTimeout(inactivityTimer);
                    inactivityTimer = null;
                    allPadsCache = []; 
                    currentApps = []; 
                    resetFormsAndMode();
                    updateDashboardStats();
                }
            });
        } catch (err) {
            console.error("Error inicializando Firebase Auth:", err);
            if(els.loginMessage) showStatus(els.loginMessage, `Error: ${err.message}`, true, 10000);
        }
    };
    const loadDataFromFirebase = () => {
        // 1. Cargar Pastillas
        const padsCollection = collection(db, "pastillas");
        onSnapshot(padsCollection, (snapshot) => {
            console.log("Datos recibidos de Firestore (pastillas).");
            allPadsCache = snapshot.docs.map(doc => ({
                id: doc.id, 
                ...doc.data() 
            }));
            allPadsCache.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
            updateDashboardStats();
            generateAutocompleteData(allPadsCache);
            updateMarcaDatalist();
            setConnectionStatus(true, `Conectado: ${allPadsCache.length} pastillas cargadas.`);
        }, (error) => {
            console.error("Error al escuchar datos de Firestore:", error);
            if (error.code === 'permission-denied') {
                 setConnectionStatus(false, `Error: Permiso denegado. Revisa las reglas de Firestore.`);
            } else {
                 setConnectionStatus(false, `Error de Base de Datos: ${error.message}`);
            }
        });
        // 2. Cargar Historial
        try {
            const historyCollection = collection(db, "historial");
            const historyQuery = query(historyCollection, orderBy("timestamp", "desc"), limit(50));
            onSnapshot(historyQuery, (snapshot) => {
                console.log("Datos de historial recibidos.");
                renderHistoryLog(snapshot.docs);
            }, (error) => {
                console.error("Error al cargar el historial:", error);
                if(els.historyLogTableBody) {
                    els.historyLogTableBody.innerHTML = `
                        <tr class="empty-row-placeholder">
                            <td colspan="4">Error al cargar el historial: ${error.message}</td>
                        </tr>`;
                }
            });
        } catch (error) {
            console.error("Error al configurar el listener de historial:", error);
        }
    };
    const setConnectionStatus = (isSuccess, message) => {
        if (!els.connectionStatus || !els.connectionStatusText) return;
        const icon = els.connectionStatus.querySelector('.material-icons-outlined');
        if (!icon) return;
        els.connectionStatus.classList.remove('status-loading', 'status-success', 'status-error');
        if (isSuccess === true) {
            els.connectionStatus.classList.add('status-success');
            icon.textContent = 'check_circle';
        } else if (isSuccess === false) {
            els.connectionStatus.classList.add('status-error');
            icon.textContent = 'error';
        } else {
            els.connectionStatus.classList.add('status-loading');
            icon.textContent = 'sync';
        }
        els.connectionStatusText.textContent = message;
    };
    // ----- INICIALIZAR UI -----
    try {
        setActiveSection('dashboard');
        updateSearchPlaceholder(); 
        initFirebase(); // <-- Llamada principal para iniciar todo
        console.log("Admin panel UI inicializado, conectando a Firebase...");
    } catch (error) {
        console.error("Error al inicializar UI:", error);
    }
}); // Fin DOMContentLoaded
