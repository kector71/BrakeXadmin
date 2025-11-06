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
    // Nuevas herramientas para el historial
    serverTimestamp,
    addDoc,
    query,
    orderBy,
    limit
} = window.firebaseTools;


document.addEventListener('DOMContentLoaded', () => {
    console.log("Admin script 2.3 (History Log) loaded. DOM ready.");

    // ----- VARIABLES GLOBALES -----
    let allPadsCache = []; 
    let currentApps = [];
    let currentEditingId = null; 
    let editingAppIndex = -1;
    let totalAppsInList = 0;
    let autocompleteData = {}; 
    let imagePreviewTimeout; 
    let searchTimeout; 
    let currentUserEmail = null; // Guardar el email del usuario logueado

    // --- Expresiones Regulares para Validación ---
    const anioRegex = /^(?:(\d{2}|\d{4})(?:-(\d{2}|\d{4}))?)$/; // Ej: 99 o 1999 o 99-05 o 1999-2005
    const medidasRegex = /^\d+(\.\d+)?\s*x\s*\d+(\.\d+)?(,\s*\d+(\.\d+)?\s*x\s*\d+(\.\d+)?)*$/; // Ej: 100 x 50 o 100 x 50, 110.5 x 60


    // ----- DOM ELEMENTS -----
    let els = {};
    try {
        console.log("Attempting to obtain DOM elements...");
        els = {
            // --- Elementos de Login/App ---
            loginContainer: document.getElementById('login-container'),
            loginForm: document.getElementById('login-form'),
            loginEmail: document.getElementById('login-email'),
            loginPassword: document.getElementById('login-password'),
            loginPasswordToggle: document.getElementById('login-password-toggle'),
            loginBtn: document.getElementById('login-btn'),
            loginMessage: document.getElementById('login-message'),
            mainAppContainer: document.getElementById('main-app-container'),
            floatingBtnContainer: document.getElementById('floating-btn-container'),
            logoutBtn: document.getElementById('logout-btn'),
            
            // --- Elementos del Panel ---
            navItems: document.querySelectorAll('.nav-item'),
            contentSections: document.querySelectorAll('.content-section'),
            pageTitle: document.getElementById('page-title'),
            padCountDashboard: document.getElementById('pad-count-dashboard'),
            appsTotalDashboard: document.getElementById('apps-total-dashboard'),
            
            // --- Exportación ---
            exportJsonBtn: document.getElementById('export-json-btn'),
            exportExcelBtn: document.getElementById('export-excel-btn'),
            
            connectionStatus: document.getElementById('connection-status'),
            connectionStatusText: document.getElementById('connection-status-text'),

            // --- Búsqueda y Formulario Principal ---
            searchRef: document.getElementById('search-ref'),
            searchType: document.getElementById('search-type'), 
            searchBtn: document.getElementById('search-btn'),
            searchResults: document.getElementById('search-results'),
            clearSearchBtn: document.getElementById('clear-search-btn'),
            formModeTitle: document.getElementById('form-mode-title'),
            editIndexInput: document.getElementById('edit-index'), 
            saveButtonText: document.getElementById('save-button-text'),
            appFormDescription: document.getElementById('app-form-description'),
            padFormMain: document.getElementById('pad-form-main'),
            padRef: document.getElementById('pad-ref'),
            padOem: document.getElementById('pad-oem'),
            padFmsi: document.getElementById('pad-fmsi'),
            padPosicion: document.getElementById('pad-posicion'),
            padMedidas: document.getElementById('pad-medidas'), 
            padImagenes: document.getElementById('pad-imagenes'),
            imagePreviewContainer: document.getElementById('image-preview-container'),
            
            // --- Formulario de Apps ---
            appForm: document.getElementById('app-form'),
            editingAppIndexInput: document.getElementById('editing-app-index'),
            appMarca: document.getElementById('app-marca'),
            appSerie: document.getElementById('app-serie'),
            appLitros: document.getElementById('app-litros'),
            appAnio: document.getElementById('app-anio'),
            appEspec: document.getElementById('app-especificacion'),
            addUpdateAppBtn: document.getElementById('add-update-app-btn'),
            addAppButtonText: document.getElementById('add-app-button-text'),
            cancelEditAppBtn: document.getElementById('cancel-edit-app-btn'),
            currentAppsList: document.getElementById('current-apps-list'),

            // --- Acciones de Guardado ---
            savePadBtn: document.getElementById('save-pad-btn'),
            deletePadBtn: document.getElementById('delete-pad-btn'),
            duplicatePadBtn: document.getElementById('duplicate-pad-btn'), 
            savePadStatus: document.getElementById('save-pad-status'),
            
            // --- Modo Oscuro y Modal ---
            darkBtn: document.getElementById('darkBtn'),
            sunIcon: document.querySelector('.lp-icon-sun'),
            moonIcon: document.querySelector('.lp-icon-moon'),
            confirmModalOverlay: document.getElementById('confirm-modal-overlay'),
            confirmModalContent: document.querySelector('#confirm-modal-content'),
            confirmModalTitle: document.getElementById('confirm-modal-title'),
            confirmModalMessage: document.getElementById('confirm-modal-message'),
            confirmModalBtnYes: document.getElementById('confirm-modal-btn-yes'),
            confirmModalBtnNo: document.getElementById('confirm-modal-btn-no'),

            // --- Autocompletado ---
            marcasList: document.getElementById('marcas-list'), 
            seriesList: document.getElementById('series-list'),

            // --- Historial ---
            historyLogTableBody: document.getElementById('history-log-table-body')
        };
        
        // Revisar elementos cruciales
        if (!els.loginContainer || !els.mainAppContainer || !els.pageTitle || !els.exportJsonBtn || !els.historyLogTableBody) {
             throw new Error("Elementos esenciales del layout o formulario no encontrados.");
        }
        console.log("DOM elements obtained successfully.");
    } catch (error) {
        console.error("Error obtaining DOM elements:", error);
        console.error("Error crítico: No se encontraron elementos HTML necesarios. Revisa IDs.");
        return; 
    }

    // ----- FUNCIONES -----
    
    // --- Modal de Confirmación ---
    let confirmResolve = null;
    const showCustomConfirm = (message, title = "Confirmar Acción", confirmText = "Confirmar", confirmClass = "btn-danger") => {
        if (!els.confirmModalOverlay) return Promise.resolve(false); // Fallback
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
        if (!sectionId || typeof sectionId !== 'string') return;
        els.contentSections?.forEach(section => section.classList.remove('active'));
        els.navItems?.forEach(item => {
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
            setActiveSection('dashboard');
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
            return true;
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
            case 'ref':
                els.searchRef.placeholder = "Ej: 7104INC";
                break;
            case 'fmsi':
                els.searchRef.placeholder = "Ej: D1047";
                break;
            case 'oem':
                els.searchRef.placeholder = "Ej: 123456789";
                break;
            case 'app':
                els.searchRef.placeholder = "Ej: Chevrolet Spark";
                break;
        }
    };

    const performSearch = () => {
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
                    case 'ref':
                        foundMatch = (pad.ref || []).find(r => r.toLowerCase().includes(query));
                        break;
                    case 'fmsi':
                        foundMatch = (pad.fmsi || []).find(f => f.toLowerCase().includes(query));
                        break;
                    case 'oem':
                        foundMatch = (pad.oem || []).find(o => o.toLowerCase().includes(query));
                        break;
                    case 'app':
                        const foundApp = (pad.aplicaciones || []).find(app => 
                            (app.marca && app.marca.toLowerCase().includes(query)) || 
                            (app.serie && app.serie.toLowerCase().includes(query))
                        );
                        if (foundApp) {
                            foundMatch = `${foundApp.marca} ${foundApp.serie}`;
                        }
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
        renderCurrentApps();
    };

    // --- Estadísticas (ahora usa allPadsCache) ---
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

    // --- Renderizado de Lista de Apps ---
    const renderCurrentApps = () => {
        if (!els.currentAppsList) return;
        if (!Array.isArray(currentApps) || currentApps.length === 0) {
            els.currentAppsList.innerHTML = '<li class="empty-list">Ninguna todavía</li>';
            return;
        }
        els.currentAppsList.innerHTML = currentApps.map((app, index) => {
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
                        <button type="button" class="app-action-btn edit-app-btn" data-index="${index}" title="Editar App">
                            <span class="material-icons-outlined">edit</span>
                        </button>
                        <button type="button" class="app-action-btn remove-app-btn" data-index="${index}" title="Eliminar App">
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
        
        validateField(els.appAnio, anioRegex); 
        updateSerieDatalist(app.marca || ""); 

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
            if (typeof padData.medidas === 'string') {
                els.padMedidas.value = padData.medidas || '';
            } else if (Array.isArray(padData.medidas)) {
                els.padMedidas.value = padData.medidas.join(', ');
            } else {
                els.padMedidas.value = '';
            }
        }
        validateField(els.padMedidas, medidasRegex); 

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
            showStatus(els.connectionStatusText, "Exportación JSON exitosa.", false, 3000);
        } catch (error) {
            console.error("Error al exportar JSON:", error);
            showStatus(els.connectionStatusText, "Error al generar el JSON.", true, 3000);
        }
    };

    const exportToExcel = () => {
        if (allPadsCache.length === 0) {
            showStatus(els.connectionStatusText, "No hay datos para exportar.", true, 3000);
            return;
        }

        if (typeof XLSX === 'undefined') {
            console.error("La librería XLSX (SheetJS) no está cargada.");
            showStatus(els.connectionStatusText, "Error: La librería de exportación no cargó. Refresca la página.", true, 5000);
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
            
            showStatus(els.connectionStatusText, "Exportación Excel exitosa.", false, 3000);

        } catch (error) {
            console.error("Error al exportar Excel:", error);
            showStatus(els.connectionStatusText, "Error al generar el archivo Excel.", true, 3000);
        }
    };


    // --- Funciones de Historial ---
    const logHistory = async (accion, padId) => {
        try {
            if (!currentUserEmail) {
                console.warn("Intento de log sin email de usuario.");
                return;
            }

            const historyCollection = collection(db, "historial");
            await addDoc(historyCollection, {
                usuarioEmail: currentUserEmail,
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
            if (data.timestamp) {
                fechaFormateada = data.timestamp.toDate().toLocaleString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
            }

            // Mapear acción a clase CSS
            let accionClass = `log-action-${data.accion.replace(' (', '-').replace(')', '')}`;
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


    // ----- EVENT LISTENERS -----
    try {
        console.log("Adding event listeners...");

        // --- Listeners de Login/Logout ---
        els.loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!els.loginEmail || !els.loginPassword || !els.loginBtn || !els.loginMessage) return;

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

        els.logoutBtn.addEventListener('click', async () => {
             const confirmed = await showCustomConfirm("¿Estás seguro de que quieres cerrar sesión?", "Cerrar Sesión", "Cerrar Sesión", "btn-danger");
             if (confirmed) {
                 try {
                     await signOut(auth);
                     allPadsCache = []; 
                     currentApps = [];
                     resetFormsAndMode();
                     updateDashboardStats(); 
                     currentUserEmail = null; // Limpiar email al salir
                 } catch (error) {
                     console.error("Error al cerrar sesión:", error);
                 }
             }
        });

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

        // Modales
        els.confirmModalBtnYes?.addEventListener('click', () => hideCustomConfirm(true));
        els.confirmModalBtnNo?.addEventListener('click', () => hideCustomConfirm(false));
        els.confirmModalOverlay?.addEventListener('click', (e) => {
            if (e.target === els.confirmModalOverlay) hideCustomConfirm(false);
        });

        // Navegación
        els.navItems?.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset?.section;
                if (section) setActiveSection(section);
            });
        });

        // Exportación
        els.exportJsonBtn.addEventListener('click', exportToJSON);
        els.exportExcelBtn.addEventListener('click', exportToExcel);

        // --- BÚSQUEDA ---
        els.searchBtn.addEventListener('click', performSearch);
        els.searchType.addEventListener('change', updateSearchPlaceholder); 
        
        els.searchRef.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(performSearch, 300);
        });
        els.searchRef.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); clearTimeout(searchTimeout); performSearch(); }
        });

        els.searchResults.addEventListener('click', (e) => {
            const targetButton = e.target.closest('.edit-btn');
            if (targetButton) {
                const docId = targetButton.dataset.id; 
                if (docId) {
                     loadPadDataIntoForms(docId); 
                }
            }
        });

        // Limpiar Form
        els.clearSearchBtn.addEventListener('click', resetFormsAndMode);

        // Form App Submit
        els.appForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const isAnioValid = validateField(els.appAnio, anioRegex);
            if (!isAnioValid) {
                 showStatus(els.savePadStatus, "El formato del Año de la aplicación es incorrecto.", true, 3000);
                 els.appAnio.focus();
                 return;
            }

            const app = {
                marca: els.appMarca.value.trim(),
                serie: els.appSerie.value.trim(),
                litros: els.appLitros?.value.trim() || '',
                año: els.appAnio?.value.trim() || '',
                especificacion: els.appEspec?.value.trim() || '',
            };
            if (!app.marca || !app.serie) {
                showStatus(els.savePadStatus, "Marca y Serie son obligatorios para la aplicación.", true, 3000);
                if(!app.marca) els.appMarca?.focus(); else els.appSerie?.focus();
                return;
            }
            if (!Array.isArray(currentApps)) currentApps = [];
            if (editingAppIndex > -1 && editingAppIndex < currentApps.length) {
                currentApps[editingAppIndex] = app;
            } else {
                currentApps.push(app);
            }
            renderCurrentApps();
            resetAppForm();
            if(els.appMarca) els.appMarca.focus();
        });

        // Cancelar Edit App
        els.cancelEditAppBtn.addEventListener('click', resetAppForm);

        // Clics Lista Apps (Editar/Eliminar)
        els.currentAppsList.addEventListener('click', async (e) => {
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
                    renderCurrentApps();
                    if (editingAppIndex === index) resetAppForm();
                    else if (editingAppIndex > index) {
                        editingAppIndex--; 
                        if (els.editingAppIndexInput) els.editingAppIndexInput.value = editingAppIndex;
                    }
                }
            }
        });

        // --- GUARDAR/ACTUALIZAR PASTILLA (FIREBASE) ---
        els.savePadBtn.addEventListener('click', async () => {
            const isMedidasValid = validateField(els.padMedidas, medidasRegex);
            if (!isMedidasValid) {
                 showStatus(els.savePadStatus, "El formato de Medidas es incorrecto. Debe ser '100 x 50' o '100 x 50, 110 x 60'.", true, 5000);
                 els.padMedidas.focus();
                 return;
            }

            const refsArray = (els.padRef.value || '').split(',').map(s => s.trim()).filter(Boolean);
            if (refsArray.length === 0) {
                showStatus(els.savePadStatus, "La Referencia (ID) es obligatoria.", true);
                if(els.padRef.focus) els.padRef.focus();
                return;
            }
            
            showStatus(els.savePadStatus, "Guardando en Firebase...", false, 10000);
            
            const newPad = {
                ref: refsArray,
                oem: (els.padOem?.value || '').split(',').map(s => s.trim()).filter(Boolean),
                fmsi: (els.padFmsi?.value || '').split(',').map(s => s.trim()).filter(Boolean),
                posición: els.padPosicion?.value || 'Delantera',
                medidas: (els.padMedidas?.value || '').split(',').map(s => s.trim()).filter(Boolean),
                imagenes: (els.padImagenes?.value || '').split(',').map(s => s.trim()).filter(Boolean),
                aplicaciones: Array.isArray(currentApps) ? currentApps : [],
            };

            
            const docId = refsArray[0]; 
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
                showStatus(els.connectionStatusText, message, false);

            } catch (err) {
                console.error("Error guardando en Firebase:", err);
                showStatus(els.savePadStatus, `Error de Firebase: ${err.message}`, true, 6000);
            }
        });
        
        // --- ELIMINAR PASTILLA (FIREBASE) ---
        els.deletePadBtn.addEventListener('click', async () => {
            if (!currentEditingId) {
                showStatus(els.savePadStatus, "No hay pastilla válida cargada para eliminar.", true);
                return;
            }

            const refId = currentEditingId;
            const message = `¿Estás SEGURO de eliminar la pastilla "${refId}" de la base de datos? Esta acción es permanente.`;
            
            const confirmed = await showCustomConfirm(message, "Eliminar Pastilla", "Sí, Eliminar", "btn-danger");
            
            if (confirmed) {
                showStatus(els.savePadStatus, "Eliminando de Firebase...", false, 10000);
                try {
                    const docRef = doc(db, "pastillas", refId);
                    await deleteDoc(docRef);
                    
                    logHistory("Eliminar", refId);
                    
                    showStatus(els.connectionStatusText, `Pastilla "${refId}" eliminada.`, false);
                    resetFormsAndMode();
                    setActiveSection('dashboard');
                
                } catch (err) {
                    console.error("Error eliminando de Firebase:", err);
                    showStatus(els.savePadStatus, `Error de Firebase: ${err.message}`, true, 6000);
                }
            }
        });

        // --- LISTENER: DUPLICAR PASTILLA ---
        els.duplicatePadBtn.addEventListener('click', () => {
            if (!currentEditingId) { 
                showStatus(els.savePadStatus, "Carga una pastilla primero para duplicarla.", true);
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
            showStatus(els.savePadStatus, "Modo 'Duplicar' activado. Cambia la 'Ref' y guarda.", false, 6000);
        });

        // --- LISTENER: PREVISUALIZACIÓN DE IMÁGENES ---
        if (els.padImagenes) {
            els.padImagenes.addEventListener('input', () => {
                clearTimeout(imagePreviewTimeout);
                imagePreviewTimeout = setTimeout(renderImagePreview, 300); 
            });
        }
        
        // --- LISTENERS PARA VALIDACIÓN Y AUTOCOMPLETADO ---
        if(els.appMarca) {
            els.appMarca.addEventListener('input', () => updateSerieDatalist(els.appMarca.value.trim()));
        }
        if(els.appAnio) {
            els.appAnio.addEventListener('input', () => validateField(els.appAnio, anioRegex));
        }
        if(els.padMedidas) {
            els.padMedidas.addEventListener('input', () => validateField(els.padMedidas, medidasRegex));
        }

        // --- LISTENER MODO OSCURO ---
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
    // Lógica de Inicialización de Firebase (Actualizada)
    // =============================================
    const initFirebase = () => {
        try {
            onAuthStateChanged(auth, (user) => {
                if (user && !user.isAnonymous) {
                    // --- Usuario AUTENTICADO ---
                    console.log("Usuario autenticado:", user.uid, user.email);
                    currentUserEmail = user.email; // Guardar el email
                    if(els.mainAppContainer) els.mainAppContainer.style.display = 'block';
                    if(els.floatingBtnContainer) els.floatingBtnContainer.style.display = 'block';
                    if(els.loginContainer) els.loginContainer.style.display = 'none';
                    loadDataFromFirebase();
                } else {
                    // --- Usuario NO autenticado ---
                    console.log("Usuario no logueado.");
                    currentUserEmail = null; // Limpiar email
                    if(els.mainAppContainer) els.mainAppContainer.style.display = 'none';
                    if(els.floatingBtnContainer) els.floatingBtnContainer.style.display = 'none';
                    if(els.loginContainer) els.loginContainer.style.display = 'flex';
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
            console.log("Datos recibidos de Firestore (snapshot).");
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
        initFirebase(); // Llamada principal para iniciar todo
        console.log("Admin panel UI inicializado, conectando a Firebase...");
    } catch (error) {
        console.error("Error al inicializar UI:", error);
    }

}); // Fin DOMContentLoaded
