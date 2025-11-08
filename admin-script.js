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
    console.log("Admin script 2.6 + VIN API loaded. DOM ready.");
    
    // ----- VARIABLES GLOBALES -----
    let allPadsCache = []; 
    let currentApps = [];
    let currentEditingId = null; 
    let editingAppIndex = -1;
    let totalAppsInList = 0;
    let autocompleteData = {}; 
    let imagePreviewTimeout; 
    let searchTimeout; 
    let inactivityTimer;
    const INACTIVITY_DURATION = 15 * 60 * 1000; // 15 minutos
    const anioRegex = /^(?:(\d{2}|\d{4})(?:-(\d{2}|\d{4}))?)$/;
    const medidasRegex = /^\d+(\.\d+)?\s*x\s*\d+(\.\d+)?(,\s*\d+(\.\d+)?\s*x\s*\d+(\.\d+)?)*$/;

    // ----- DOM ELEMENTS -----
    let els = {};
    try {
        const getEl = id => document.getElementById(id);
        els = {
            // Login / App
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
            // Panel
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
            historyLogTableBody: getEl('history-log-table-body'),
            filterAppsInput: getEl('filter-apps-input'),
            // --- NUEVO: VIN ---
            vinLookupBtn: getEl('vin-lookup-btn')
        };

        if (!els.loginContainer || !els.mainAppContainer || !els.pageTitle || !els.darkBtn) {
            throw new Error("Elementos esenciales del layout no encontrados.");
        }
        console.log("DOM elements obtenidos.");
    } catch (error) {
        console.error("Error al obtener elementos del DOM:", error);
        return;
    }

    // --- MODAL DE CONFIRMACIÓN ---
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

    // --- NAVEGACIÓN ---
    const setActiveSection = (sectionId) => {
        if (!sectionId || !els.contentSections || !els.navItems) return;
        els.contentSections.forEach(section => section.classList.remove('active'));
        els.navItems.forEach(item => {
            if (item.dataset?.section) item.classList.toggle('active', item.dataset.section === sectionId);
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
            console.error(`Sección '${sectionId}' no encontrada. Redirigiendo a dashboard.`);
            if (sectionId !== 'dashboard') setActiveSection('dashboard');
        }
    };

    // --- PREVISUALIZACIÓN DE IMÁGENES ---
    const renderImagePreview = () => {
        if (!els.imagePreviewContainer || !els.padImagenes) return;
        const urls = els.padImagenes.value.split(',').map(u => u.trim()).filter(Boolean);
        els.imagePreviewContainer.innerHTML = '';
        urls.forEach(url => {
            const wrapper = document.createElement('div');
            wrapper.className = 'preview-image-wrapper';
            const img = document.createElement('img');
            img.src = url;
            img.onerror = () => {
                img.style.display = 'none';
                const icon = document.createElement('span');
                icon.className = 'material-icons-outlined error-icon';
                icon.textContent = 'broken_image';
                wrapper.appendChild(icon);
            };
            wrapper.appendChild(img);
            els.imagePreviewContainer.appendChild(wrapper);
        });
    };

    // --- VALIDACIÓN ---
    const validateField = (el, regex) => {
        if (!el) return false;
        const v = el.value.trim();
        if (v === "") {
            el.classList.remove('is-valid', 'is-invalid');
            return true;
        }
        if (regex.test(v)) {
            el.classList.add('is-valid');
            el.classList.remove('is-invalid');
            return true;
        } else {
            el.classList.add('is-invalid');
            el.classList.remove('is-valid');
            return false;
        }
    };

    // --- AUTOCOMPLETADO ---
    const generateAutocompleteData = (pads) => {
        autocompleteData = {};
        if (!Array.isArray(pads)) return;
        for (const pad of pads) {
            if (Array.isArray(pad.aplicaciones)) {
                for (const app of pad.aplicaciones) {
                    const m = (app.marca || "").trim();
                    const s = (app.serie || "").trim();
                    if (m) {
                        if (!autocompleteData[m]) autocompleteData[m] = new Set();
                        if (s) autocompleteData[m].add(s);
                    }
                }
            }
        }
    };
    const updateMarcaDatalist = () => {
        if (!els.marcasList) return;
        const marcas = Object.keys(autocompleteData).sort();
        els.marcasList.innerHTML = marcas.map(m => `<option value="${m}"></option>`).join('');
    };
    const updateSerieDatalist = (marca) => {
        if (!els.seriesList) return;
        els.seriesList.innerHTML = '';
        const data = autocompleteData[marca];
        if (data && data.size > 0) {
            const series = Array.from(data).sort();
            els.seriesList.innerHTML = series.map(s => `<option value="${s}"></option>`).join('');
        }
    };

    // --- BÚSQUEDA ---
    const updateSearchPlaceholder = () => {
        if (!els.searchType || !els.searchRef) return;
        const t = els.searchType.value;
        switch(t) {
            case 'ref': els.searchRef.placeholder = "Ej: 7104INC"; break;
            case 'fmsi': els.searchRef.placeholder = "Ej: D1047"; break;
            case 'oem': els.searchRef.placeholder = "Ej: 123456789"; break;
            case 'app': els.searchRef.placeholder = "Ej: Chevrolet Spark"; break;
        }
    };
    const performSearch = () => {
        if (!els.searchRef || !els.searchType || !els.searchResults) return;
        const q = els.searchRef.value.trim().toLowerCase();
        const t = els.searchType.value;
        if (q.length < 2) {
            els.searchResults.innerHTML = q.length === 0 ? '' : '<div class="search-feedback error">Mínimo 2 caracteres.</div>';
            return;
        }
        if (!Array.isArray(allPadsCache) || allPadsCache.length === 0) {
            els.searchResults.innerHTML = '<div class="search-feedback error">Base de datos vacía.</div>';
            return;
        }
        const results = allPadsCache.reduce((acc, pad) => {
            let match = null;
            switch(t) {
                case 'ref': match = (pad.ref || []).find(r => r.toLowerCase().includes(q)); break;
                case 'fmsi': match = (pad.fmsi || []).find(f => f.toLowerCase().includes(q)); break;
                case 'oem': match = (pad.oem || []).find(o => o.toLowerCase().includes(q)); break;
                case 'app':
                    const a = (pad.aplicaciones || []).find(app => 
                        (app.marca && app.marca.toLowerCase().includes(q)) || 
                        (app.serie && app.serie.toLowerCase().includes(q))
                    );
                    if (a) match = `${a.marca} ${a.serie}`;
                    break;
            }
            if (match) acc.push({ pad, docId: pad.id, foundText: match });
            return acc;
        }, []);
        if (results.length === 0) {
            els.searchResults.innerHTML = `<div class="search-feedback">Sin resultados para "${q}".</div>`;
        } else {
            els.searchResults.innerHTML = results.map(r => `
                <div class="search-result-item">
                    <div>
                        <span class="search-result-match">${r.foundText}</span>
                        <span class="search-result-context">(${t.toUpperCase()} / ${r.pad.ref[0] || 'N/A'})</span>
                    </div>
                    <button type="button" class="btn btn-secondary edit-btn" data-id="${r.docId}">Cargar</button>
                </div>
            `).join('');
        }
    };

    // --- RESETS ---
    const resetAppForm = () => {
        if (els.appForm) els.appForm.reset();
        editingAppIndex = -1;
        if (els.editingAppIndexInput) els.editingAppIndexInput.value = "-1";
        if (els.addAppButtonText) els.addAppButtonText.textContent = "Añadir App";
        if (els.addUpdateAppBtn) {
            els.addUpdateAppBtn.classList.remove('btn-primary');
            els.addUpdateAppBtn.classList.add('btn-tertiary');
        }
        if (els.cancelEditAppBtn) els.cancelEditAppBtn.style.display = 'none';
        if (els.appFormDescription) els.appFormDescription.textContent = "Añade vehículos compatibles.";
        if (els.appAnio) els.appAnio.classList.remove('is-valid', 'is-invalid');
        if (els.seriesList) els.seriesList.innerHTML = '';
        if (els.filterAppsInput) els.filterAppsInput.value = '';
    };
    const resetFormsAndMode = () => {
        if (els.padFormMain) els.padFormMain.reset();
        currentEditingId = null;
        currentApps = [];
        if (els.formModeTitle) els.formModeTitle.textContent = "Añadir Nueva Pastilla";
        if (els.saveButtonText) els.saveButtonText.textContent = "Guardar Pastilla";
        if (els.savePadBtn) els.savePadBtn.className = 'btn btn-primary btn-cta';
        if (els.deletePadBtn) els.deletePadBtn.style.display = 'none';
        if (els.duplicatePadBtn) els.duplicatePadBtn.style.display = 'none';
        if (els.searchRef) els.searchRef.value = '';
        if (els.searchResults) els.searchResults.innerHTML = '';
        if (els.clearSearchBtn) els.clearSearchBtn.style.display = 'none';
        if (els.imagePreviewContainer) els.imagePreviewContainer.innerHTML = '';
        if (els.padMedidas) els.padMedidas.classList.remove('is-valid', 'is-invalid');
        resetAppForm();
        renderCurrentApps();
    };

    // --- ESTADÍSTICAS ---
    const calculateTotalApps = () => {
        return allPadsCache.reduce((t, p) => t + ((p.aplicaciones || []).length), 0);
    };
    const updateDashboardStats = () => {
        totalAppsInList = calculateTotalApps();
        if (els.padCountDashboard) els.padCountDashboard.textContent = allPadsCache.length;
        if (els.appsTotalDashboard) els.appsTotalDashboard.textContent = totalAppsInList;
    };

    // --- MENSAJES ---
    const showStatus = (el, msg, isError = false, dur = 4000) => {
        if (!el) return;
        el.textContent = msg;
        el.className = 'status-message';
        el.classList.add(isError ? 'error' : 'success');
        if (el.timeoutId) clearTimeout(el.timeoutId);
        el.timeoutId = setTimeout(() => {
            if (el) {
                el.textContent = '';
                el.className = 'status-message';
                delete el.timeoutId;
            }
        }, dur);
    };

    // --- RENDER APPS CON FILTRO ---
    const renderCurrentApps = (filter = "") => {
        if (!els.currentAppsList) return;
        const f = filter.toLowerCase();
        const filtered = currentApps.filter(app => {
            const s = `${app.marca || ''} ${app.serie || ''} ${app.litros || ''} ${app.año || ''} ${app.especificacion || ''}`.toLowerCase();
            return s.includes(f);
        });
        if (filtered.length === 0) {
            if (currentApps.length > 0 && filter) {
                els.currentAppsList.innerHTML = `<li class="empty-list">No hay coincidencias para "${filter}".</li>`;
            } else {
                els.currentAppsList.innerHTML = '<li class="empty-list">Ninguna todavía</li>';
            }
            return;
        }
        els.currentAppsList.innerHTML = filtered.map((app, i) => {
            const origIdx = currentApps.findIndex(a => a === app);
            const marca = app.marca || '';
            const serie = app.serie || '';
            const details = [app.litros, app.año, app.especificacion].filter(Boolean).join(' | ');
            return `
                <li>
                    <div class="app-info">
                        <strong>${marca} ${serie}</strong>
                        ${details ? `<span class="app-details">${details}</span>` : ''}
                    </div>
                    <div class="app-actions">
                        <button type="button" class="app-action-btn edit-app-btn" data-index="${origIdx}" title="Editar">
                            <span class="material-icons-outlined">edit</span>
                        </button>
                        <button type="button" class="app-action-btn remove-app-btn" data-index="${origIdx}" title="Eliminar">
                            <span class="material-icons-outlined">delete_forever</span>
                        </button>
                    </div>
                </li>`;
        }).join('');
    };

    // --- CARGAR DATOS ---
    const loadAppDataIntoForm = (idx) => {
        if (!Array.isArray(currentApps) || idx < 0 || idx >= currentApps.length) return;
        const app = currentApps[idx];
        editingAppIndex = idx;
        if (els.editingAppIndexInput) els.editingAppIndexInput.value = idx;
        if (els.appMarca) els.appMarca.value = app.marca || '';
        if (els.appSerie) els.appSerie.value = app.serie || '';
        if (els.appLitros) els.appLitros.value = app.litros || '';
        if (els.appAnio) {
            els.appAnio.value = app.año || '';
            validateField(els.appAnio, anioRegex);
        }
        if (els.appEspec) els.appEspec.value = app.especificacion || '';
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
    const loadPadDataIntoForms = (id) => {
        const pad = allPadsCache.find(p => p.id === id);
        if (!pad) {
            console.error("Pastilla no encontrada:", id);
            return;
        }
        currentEditingId = id;
        if (els.padRef) els.padRef.value = (pad.ref || []).join(', ');
        if (els.padOem) els.padOem.value = (pad.oem || []).join(', ');
        if (els.padFmsi) els.padFmsi.value = (pad.fmsi || []).join(', ');
        if (els.padPosicion) els.padPosicion.value = pad.posición || 'Delantera';
        if (els.padMedidas) {
            els.padMedidas.value = Array.isArray(pad.medidas) ? pad.medidas.join(', ') : (pad.medidas || '');
            validateField(els.padMedidas, medidasRegex);
        }
        if (els.padImagenes) els.padImagenes.value = (pad.imagenes || []).join(', ');
        renderImagePreview();
        currentApps = Array.isArray(pad.aplicaciones) ? JSON.parse(JSON.stringify(pad.aplicaciones)) : [];
        const ref0 = (pad.ref || [])[0] || '';
        if (els.formModeTitle) els.formModeTitle.textContent = `Editando Pastilla: ${ref0}`;
        if (els.saveButtonText) els.saveButtonText.textContent = "Actualizar Pastilla";
        if (els.savePadBtn) els.savePadBtn.className = 'btn btn-primary btn-cta';
        if (els.deletePadBtn) els.deletePadBtn.style.display = 'inline-flex';
        if (els.duplicatePadBtn) els.duplicatePadBtn.style.display = 'inline-flex';
        if (els.clearSearchBtn) els.clearSearchBtn.style.display = 'inline-flex';
        if (els.searchResults) els.searchResults.innerHTML = '';
        renderCurrentApps();
        resetAppForm();
        setActiveSection('edit-pad');
        if (els.padRef) els.padRef.focus();
    };

    // --- EFECTO RIPPLE ---
    const createRippleEffect = (e) => {
        const btn = e.currentTarget;
        if (!btn || typeof btn.getBoundingClientRect !== 'function') return;
        const circle = document.createElement('span');
        const d = Math.max(btn.clientWidth, btn.clientHeight);
        const r = d / 2;
        const rect = btn.getBoundingClientRect();
        circle.style.width = circle.style.height = `${d}px`;
        const x = e.clientX - rect.left - r;
        const y = e.clientY - rect.top - r;
        circle.style.left = `${x}px`;
        circle.style.top = `${y}px`;
        circle.classList.add('ripple');
        const existing = btn.querySelector('.ripple');
        if (existing) existing.remove();
        btn.insertBefore(circle, btn.firstChild);
        circle.addEventListener('animationend', () => circle.remove(), { once: true });
    };

    // --- EXPORTACIÓN ---
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
            showStatus(els.connectionStatusText, "No hay datos para exportar.", true);
            return;
        }
        try {
            const json = JSON.stringify(allPadsCache, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            downloadBlob(blob, `brakeX_export_${new Date().toISOString().split('T')[0]}.json`);
            showStatus(els.connectionStatusText, "Exportación JSON exitosa.", false);
        } catch (err) {
            console.error("Error exportando JSON:", err);
            showStatus(els.connectionStatusText, "Error al generar JSON.", true);
        }
    };
    const exportToExcel = () => {
        if (allPadsCache.length === 0) {
            showStatus(els.connectionStatusText, "No hay datos para exportar.", true);
            return;
        }
        if (typeof XLSX === 'undefined') {
            console.error("XLSX no cargado.");
            showStatus(els.connectionStatusText, "Error: librería de exportación no cargada.", true, 5000);
            return;
        }
        try {
            const pads = allPadsCache.map(p => ({
                id: p.id,
                ref: (p.ref || []).join(', '),
                oem: (p.oem || []).join(', '),
                fmsi: (p.fmsi || []).join(', '),
                posicion: p.posición || '',
                medidas: (p.medidas || []).join(', '),
                imagenes: (p.imagenes || []).join(', '),
                num_apps: (p.aplicaciones || []).length
            }));
            const apps = [];
            allPadsCache.forEach(p => {
                if (Array.isArray(p.aplicaciones)) {
                    p.aplicaciones.forEach(a => {
                        apps.push({
                            pad_id: p.id,
                            marca: a.marca || '',
                            serie: a.serie || '',
                            litros: a.litros || '',
                            año: a.año || '',
                            especificacion: a.especificacion || ''
                        });
                    });
                }
            });
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pads), "Pastillas");
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(apps), "Aplicaciones");
            XLSX.writeFile(wb, `brakeX_export_${new Date().toISOString().split('T')[0]}.xlsx`);
            showStatus(els.connectionStatusText, "Exportación Excel exitosa.", false);
        } catch (err) {
            console.error("Error exportando Excel:", err);
            showStatus(els.connectionStatusText, "Error al generar Excel.", true);
        }
    };

    // --- HISTORIAL ---
    const logHistory = async (accion, padId) => {
        try {
            const user = auth.currentUser;
            if (!user) return;
            const col = collection(db, "historial");
            await addDoc(col, {
                usuarioEmail: user.email,
                accion: accion,
                padId: padId,
                timestamp: serverTimestamp()
            });
        } catch (err) {
            console.error("Error al loguear:", err);
        }
    };
    const renderHistoryLog = (docs) => {
        if (!els.historyLogTableBody) return;
        if (docs.length === 0) {
            els.historyLogTableBody.innerHTML = '<tr class="empty-row-placeholder"><td colspan="4">Sin historial.</td></tr>';
            return;
        }
        let html = '';
        docs.forEach(doc => {
            const d = doc.data();
            const fecha = d.timestamp?.toDate?.().toLocaleString('es-ES', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            }) || 'N/A';
            const clase = `log-action-${d.accion.replace(/ \(/g, '-').replace(')', '')}`;
            html += `
                <tr>
                    <td>${d.usuarioEmail || 'N/A'}</td>
                    <td><span class="log-action ${clase}">${d.accion}</span></td>
                    <td>${d.padId || 'N/A'}</td>
                    <td>${fecha}</td>
                </tr>
            `;
        });
        els.historyLogTableBody.innerHTML = html;
    };

    // --- ESTANDARIZACIÓN ---
    const standardizeText = (text, type = 'none') => {
        if (typeof text !== 'string' || !text) return '';
        switch (type) {
            case 'title':
                return text.toLowerCase().split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
            case 'upper':
                return text.toUpperCase();
            default:
                return text;
        }
    };

    // --- SESIÓN ---
    const forceLogout = async (msg) => {
        try {
            await signOut(auth);
            if (els.loginMessage) showStatus(els.loginMessage, msg, false, 5000);
        } catch (err) {
            console.error("Error cerrando sesión:", err);
        }
    };
    const resetInactivityTimer = () => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            forceLogout("Sesión cerrada por inactividad (15 minutos).");
        }, INACTIVITY_DURATION);
    };
    const setupInactivityLogout = () => {
        ['mousemove', 'keypress', 'click', 'scroll'].forEach(evt => {
            document.addEventListener(evt, resetInactivityTimer);
        });
        resetInactivityTimer();
    };
    const setupSessionPersistence = async () => {
        try {
            await setPersistence(auth, browserSessionPersistence);
            console.log("Persistencia de sesión: sesion actual.");
        } catch (err) {
            console.error("Error en persistencia de sesión:", err);
        }
    };

    // --- BÚSQUEDA POR VIN (NUEVO) ---
    const lookupVIN = async () => {
        const vin = prompt("Ingresa el VIN del vehículo (17 caracteres):");
        if (!vin || vin.length !== 17) {
            if (vin !== null) showStatus(els.savePadStatus, "El VIN debe tener exactamente 17 caracteres.", true, 4000);
            return;
        }

        showStatus(els.savePadStatus, "Buscando datos del VIN...", false, 10000);

        try {
            const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`);
            const data = await res.json();

   
