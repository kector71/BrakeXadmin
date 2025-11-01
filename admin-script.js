document.addEventListener('DOMContentLoaded', () => {
    console.log("Admin script loaded. DOM ready.");

    // ----- VARIABLES GLOBALES -----
    let masterPadList = [];
    let currentApps = [];
    let editIndex = -1;
    let editingAppIndex = -1;
    let totalAppsInList = 0;
    let autocompleteData = {}; 
    let imagePreviewTimeout; 
    let searchTimeout; 

    // --- Expresiones Regulares para Validación ---
    const anioRegex = /^(?:(\d{2}|\d{4})(?:-(\d{2}|\d{4}))?)$/;
    const medidasRegex = /^\d+(\.\d+)?\s*x\s*\d+(\.\d+)?(,\s*\d+(\.\d+)?\s*x\s*\d+(\.\d+)?)*$/;


    // ----- DOM ELEMENTS -----
    let els = {};
    try {
        console.log("Attempting to obtain DOM elements...");
        els = {
            // ▼▼▼ NUEVOS ELEMENTOS PARA MENÚ MÓVIL ▼▼▼
            appLayout: document.querySelector('.app-layout'),
            menuToggleBtn: document.getElementById('menu-toggle-btn'),
            sidebarOverlay: document.getElementById('sidebar-overlay'),
            // ▲▲▲ FIN NUEVOS ELEMENTOS ▲▲▲

            navItems: document.querySelectorAll('.nav-item'),
            contentSections: document.querySelectorAll('.content-section'),
            pageTitle: document.getElementById('page-title'),
            padCountDashboard: document.getElementById('pad-count-dashboard'),
            appsTotalDashboard: document.getElementById('apps-total-dashboard'),
            fileImport: document.getElementById('file-import'),
            fileName: document.getElementById('file-name'),
            importStatus: document.getElementById('import-status'),
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
            savePadBtn: document.getElementById('save-pad-btn'),
            deletePadBtn: document.getElementById('delete-pad-btn'),
            duplicatePadBtn: document.getElementById('duplicate-pad-btn'), 
            jsonOutput: document.getElementById('json-output'),
            generateDownloadBtn: document.getElementById('generate-download-btn'),
            downloadStatus: document.getElementById('download-status'),
            copyJsonBtn: document.getElementById('copy-json-btn'),
            copyStatus: document.getElementById('copy-status'),
            clearAllBtn: document.getElementById('clear-all-btn'),
            darkBtn: document.getElementById('darkBtn'),
            sunIcon: document.querySelector('.lp-icon-sun'),
            moonIcon: document.querySelector('.lp-icon-moon'),
            savePadStatus: document.getElementById('save-pad-status'),
            confirmModalOverlay: document.getElementById('confirm-modal-overlay'),
            confirmModalContent: document.getElementById('confirm-modal-content'),
            confirmModalTitle: document.getElementById('confirm-modal-title'),
            confirmModalMessage: document.getElementById('confirm-modal-message'),
            confirmModalBtnYes: document.getElementById('confirm-modal-btn-yes'),
            confirmModalBtnNo: document.getElementById('confirm-modal-btn-no'),
            exportExcelBtn: document.getElementById('export-excel-btn'),
            marcasList: document.getElementById('marcas-list'), 
            seriesList: document.getElementById('series-list') 
        };
        
        // Verificación de elementos esenciales
        if (!els.appLayout || !els.menuToggleBtn || !els.sidebarOverlay || !els.marcasList) {
             throw new Error("Elementos esenciales del layout o formulario no encontrados (appLayout, menuToggleBtn, sidebarOverlay, marcas-list, etc).");
        }
        console.log("DOM elements obtained successfully.");
    } catch (error) {
        console.error("Error obtaining DOM elements:", error);
        console.error("Error crítico: No se encontraron elementos HTML necesarios. Revisa IDs.");
        return; 
    }

    // ----- FUNCIONES -----
    
    // --- ▼▼▼ NUEVAS FUNCIONES MENÚ MÓVIL ▼▼▼ ---
    const openSidebar = () => {
        if (els.appLayout) els.appLayout.classList.replace('sidebar-closed', 'sidebar-open');
    };
    const closeSidebar = () => {
        if (els.appLayout) els.appLayout.classList.replace('sidebar-open', 'sidebar-closed');
    };
    // --- ▲▲▲ FIN NUEVAS FUNCIONES ▲▲▲ ---


    // Modal de Confirmación
    let confirmResolve = null;
    const showCustomConfirm = (message, title = "Confirmar Acción", confirmText = "Confirmar", confirmClass = "btn-danger") => {
        if (!els.confirmModalOverlay || !els.confirmModalTitle || !els.confirmModalMessage || !els.confirmModalBtnYes) {
            console.error("Faltan elementos del modal de confirmación.");
            return Promise.resolve(false);
        }
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

    // Navegación
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
        
        closeSidebar(); // <-- AÑADIDO: Cierra el menú al hacer clic en un ítem
    };
    
    // Previsualización de Imágenes
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
    
    // Validación de Campos
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

    // Autocompletado
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


    // Resets de Formularios
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
        if (els.editIndexInput) els.editIndexInput.value = "-1";
        editIndex = -1;
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

    // Estadísticas
    const calculateTotalApps = () => {
        if (!Array.isArray(masterPadList)) return 0;
        return masterPadList.reduce((total, pad) => {
            const appsLength = (pad && Array.isArray(pad.aplicaciones)) ? pad.aplicaciones.length : 0;
            return total + appsLength;
        }, 0);
    };

    const updateDashboardStats = () => {
        totalAppsInList = calculateTotalApps();
        if (els.padCountDashboard) {
            els.padCountDashboard.textContent = Array.isArray(masterPadList) ? masterPadList.length : 0;
        }
        if (els.appsTotalDashboard) {
            els.appsTotalDashboard.textContent = totalAppsInList;
        }
    };

    // Mensajes de Estado
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

    // Generación de JSON
    const generateJsonString = () => {
        if (!Array.isArray(masterPadList) || masterPadList.length === 0) return '[]';
        const sortedList = [...masterPadList];
        sortedList.sort((a, b) => {
            const refA_id = (a?.ref?.[0] || '').toLowerCase();
            const refB_id = (b?.ref?.[0] || '').toLowerCase();
            return refA_id.localeCompare(refB_id, undefined, { numeric: true, sensitivity: 'base' });
        });
        try {
            const compactJson = JSON.stringify(sortedList);
            const formattedJson = compactJson.replace(/},{/g, '},\n{');
            return formattedJson;
        } catch (err) {
            console.error("Error stringifying data:", err);
            showStatus(els.downloadStatus, `Error interno al generar JSON: ${err.message}`, true);
            return '[]';
        }
    };

    const displayFormattedJson = (jsonString) => {
        if (!els.jsonOutput) return;
        try {
            const reCompact = jsonString.replace(/},\n{/g, '},{');
            const parsedData = JSON.parse(reCompact);
            els.jsonOutput.value = JSON.stringify(parsedData, null, 2);
        } catch (e) {
            console.error("Error formatting JSON for display:", e, jsonString);
             els.jsonOutput.value = jsonString;
        }
    };

    // Renderizado de Lista de Apps
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

    // Cargar Datos en Formularios
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

    const loadPadDataIntoForms = (padData, index) => {
         if (!padData || typeof padData !== 'object') return;
        editIndex = index;
        if (els.editIndexInput) els.editIndexInput.value = index;
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

    // Efecto Ripple
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
    
    
    // --- FUNCIÓN PROCESAR EXCEL ---
    const processExcelFile = (file) => {
        return new Promise((resolve, reject) => {
            if (typeof XLSX === 'undefined') {
                return reject(new Error("La librería XLSX no se pudo cargar. Revisa la conexión a internet."));
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = e.target.result;
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

                    if (jsonData.length < 2) {
                        throw new Error("El archivo Excel está vacío o no tiene encabezados.");
                    }
                    
                    const headers = jsonData[0].map(h => String(h).trim());
                    const rows = jsonData.slice(1);
                    
                    const colMap = {
                        ref: headers.indexOf('ref'),
                        fmsi: headers.indexOf('fmsi'),
                        posicion: headers.indexOf('posición'),
                        marca: headers.indexOf('marca'),
                        serie: headers.indexOf('serie'),
                        anio: headers.indexOf('año'),
                        litros: headers.indexOf('litros'),
                        espec: headers.indexOf('especificacion')
                    };

                    if (colMap.ref === -1 || colMap.marca === -1 || colMap.serie === -1 || colMap.anio === -1) {
                        console.error("Columnas detectadas:", headers);
                        throw new Error("El Excel no tiene las columnas requeridas. Se necesita: 'ref', 'marca', 'serie', 'año'.");
                    }

                    console.log(`✅ Leídas ${rows.length} filas desde Excel. Procesando...`);
                    
                    const pads_agrupadas = {};

                    const toTitleCase = (str) => {
                        if (!str) return "";
                        return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
                    };

                    const formatYearJS = (anio_str) => {
                        if (!anio_str) return "";
                        const partes = anio_str.split('-');
                        const partes_procesadas = partes.map(parte => {
                            const parte_limpia = parte.trim();
                            if (parte_limpia.length === 4 && /^(19|20)\d{2}$/.test(parte_limpia)) {
                                return parte_limpia.substring(2);
                            } else if (parte_limpia.length === 2 && /^\d{2}$/.test(parte_limpia)) {
                                return parte_limpia;
                            }
                            return parte_limpia;
                        });
                        const aniosUnidos = partes_procesadas.filter(Boolean).join('-');
                        const aniosPartidos = aniosUnidos.split('-');
                        if (aniosPartidos.length === 2 && aniosPartidos[0] === aniosPartidos[1]) {
                            return aniosPartidos[0];
                        }
                        return aniosUnidos;
                    };
                    
                    for (const [index, fila] of rows.entries()) {
                        const ref_id_val = String(fila[colMap.ref] || '').trim();
                        
                        if (!ref_id_val) {
                             console.warn(`⚠️ Advertencia: Fila ${index + 2} ignorada (columna 'ref' está vacía)`);
                             continue;
                        }

                        const marca_app = toTitleCase(String(fila[colMap.marca] || '').trim());
                        const serie_app = toTitleCase(String(fila[colMap.serie] || '').trim());

                        if (!marca_app || !serie_app) {
                            console.warn(`⚠️ Advertencia: Fila ${index + 2} (Ref ID: ${ref_id_val}) tiene Marca o Modelo vacío. Se incluirá igualmente.`);
                        }

                        const fmsi_val = String(fila[colMap.fmsi] || '').trim();
                        const posicion_excel = String(fila[colMap.posicion] || '').trim();
                        
                        let posicion_json = "Delantera";
                        if (posicion_excel.toLowerCase().includes("del")) posicion_json = "Delantera";
                        else if (posicion_excel.toLowerCase().includes("tras")) posicion_json = "Trasera";

                        const aplicacion_actual = {
                            "marca": marca_app,
                            "serie": serie_app,
                            "litros": String(fila[colMap.litros] || '').trim(),
                            "año": formatYearJS(String(fila[colMap.anio] || '').trim()),
                            "especificacion": String(fila[colMap.espec] || '').trim()
                        };

                        if (!(ref_id_val in pads_agrupadas)) {
                            const ref_id_con_inc = `${ref_id_val}INC`;
                            pads_agrupadas[ref_id_val] = {
                                "ref": [ref_id_con_inc],
                                "oem": [],
                                "fmsi": [fmsi_val].filter(Boolean),
                                "posición": posicion_json,
                                "medidas": [],
                                "imagenes": [],
                                "aplicaciones": [aplicacion_actual]
                            };
                        } else {
                            pads_agrupadas[ref_id_val]["aplicaciones"].push(aplicacion_actual);
                            if (fmsi_val && !pads_agrupadas[ref_id_val]["fmsi"].includes(fmsi_val)) {
                                pads_agrupadas[ref_id_val]["fmsi"].push(fmsi_val);
                            }
                        }
                    } 

                    const lista_json_final = Object.values(pads_agrupadas);
                    lista_json_final.sort((a, b) => (a?.ref?.[0] || '').toLowerCase().localeCompare((b?.ref?.[0] || '').toLowerCase(), undefined, { numeric: true }));

                    console.log(`✅ ¡Éxito! Procesadas ${lista_json_final.length} pastillas únicas desde Excel.`);
                    resolve(lista_json_final);

                } catch (err) {
                    console.error("Error al procesar el archivo Excel:", err);
                    reject(err);
                }
            };
            reader.onerror = (error) => {
                console.error("Error al leer el archivo:", error);
                reject(new Error("No se pudo leer el archivo."));
            };
            reader.readAsArrayBuffer(file);
        });
    };
    
    // --- FUNCIÓN EXPORTAR A EXCEL ---
    const exportToExcel = () => {
        if (!Array.isArray(masterPadList) || masterPadList.length === 0) {
            showStatus(els.downloadStatus, "No hay datos para exportar a Excel.", true);
            return;
        }
        console.log("Aplanando datos para exportar a Excel...");
        
        const flattenedData = [];
        const headers = [
            'ref', 'oem', 'fmsi', 'posición', 'medidas', 'imagenes',
            'marca', 'serie', 'litros', 'año', 'especificacion'
        ]; 

        for (const pad of masterPadList) {
            const refString = (pad.ref || []).join(', ');
            const oemString = (pad.oem || []).join(', ');
            const fmsiString = (pad.fmsi || []).join(', ');
            const imagenesString = (pad.imagenes || []).join(', ');
            const medidasString = (Array.isArray(pad.medidas) ? pad.medidas.join(', ') : (pad.medidas || ''));

            if (pad.aplicaciones && pad.aplicaciones.length > 0) {
                for (const app of pad.aplicaciones) {
                    flattenedData.push({
                        'ref': refString,
                        'oem': oemString,
                        'fmsi': fmsiString,
                        'posición': pad.posición || '',
                        'medidas': medidasString,
                        'imagenes': imagenesString,
                        'marca': app.marca || '',
                        'serie': app.serie || '',
                        'litros': app.litros || '',
                        'año': app.año || '',
                        'especificacion': app.especificacion || ''
                    });
                }
            } else {
                flattenedData.push({
                    'ref': refString,
                    'oem': oemString,
                    'fmsi': fmsiString,
                    'posición': pad.posición || '',
                    'medidas': medidasString,
                    'imagenes': imagenesString,
                });
            }
        }
        
        try {
            const ws = XLSX.utils.json_to_sheet(flattenedData, { 
                header: headers
            });
            
            ws['!autofilter'] = { ref: XLSX.utils.encode_range(XLSX.utils.decode_range(ws['!ref'])) };
            
            const colWidths = [
                {wch: 20}, {wch: 15}, {wch: 15}, {wch: 10}, {wch: 15}, {wch: 20},
                {wch: 20}, {wch: 25}, {wch: 10}, {wch: 15}, {wch: 25}
            ]; 
            ws['!cols'] = colWidths;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Pastillas');
            XLSX.writeFile(wb, 'data_exportada.xlsx');
            
            showStatus(els.downloadStatus, `data_exportada.xlsx generado con ${flattenedData.length} filas.`, false);

        } catch (err) {
            console.error("Error al exportar a Excel:", err);
            showStatus(els.downloadStatus, `Error al exportar Excel: ${err.message}`, true);
        }
    };


    // ----- EVENT LISTENERS -----
    try {
        console.log("Adding event listeners...");

        // --- ▼▼▼ LISTENERS MENÚ MÓVIL ▼▼▼ ---
        els.menuToggleBtn.addEventListener('click', () => {
            if (els.appLayout.classList.contains('sidebar-open')) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });
        els.sidebarOverlay.addEventListener('click', closeSidebar);
        // --- ▲▲▲ FIN LISTENERS MENÚ MÓVIL ▲▲▲ ---

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

        // Carga de Archivo (JSON o Excel)
        els.fileImport.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) {
                if (els.fileName) els.fileName.textContent = "Ningún archivo seleccionado.";
                return;
            }
            if (els.fileName) els.fileName.textContent = file.name;

            try {
                let data;
                if (file.name.endsWith('.json')) {
                    const result = await file.text();
                    let dataToParse = result;
                    if (result.startsWith('[') && result.endsWith(']') && result.includes('},\n{')) {
                         dataToParse = result.replace(/},\n{/g, '},{');
                    }
                    data = JSON.parse(dataToParse);
                    if (!Array.isArray(data)) throw new Error("JSON no es un array.");
                    console.log("✅ JSON cargado exitosamente.");

                } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                    showStatus(els.importStatus, "Procesando archivo Excel...", false, 20000);
                    data = await processExcelFile(file);
                    
                } else {
                    throw new Error("Tipo de archivo no soportado. Usa .json o .xlsx");
                }
                
                masterPadList = data;
                generateAutocompleteData(masterPadList); 
                updateMarcaDatalist(); 
                
                updateDashboardStats();
                showStatus(els.importStatus, `¡Éxito! ${masterPadList.length} pastillas cargadas desde ${file.name}.`, false);
                resetFormsAndMode();
                if (els.jsonOutput) els.jsonOutput.value = '';

            } catch (err) {
                console.error("Error al procesar archivo:", err);
                showStatus(els.importStatus, `Error: ${err.message}`, true);
                masterPadList = [];
                generateAutocompleteData([]); 
                updateMarcaDatalist(); 
                updateDashboardStats();
                if (els.fileName) els.fileName.textContent = file.name + " (Error)";
                if (els.jsonOutput) els.jsonOutput.value = '';
            } finally {
                if (e.target) e.target.value = null; 
            }
        });

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
            if (!Array.isArray(masterPadList) || masterPadList.length === 0) {
                els.searchResults.innerHTML = '<div class="search-feedback error">Carga datos primero.</div>';
                return;
            }

            const results = masterPadList.reduce((acc, pad, index) => {
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
                     acc.push({ pad, index, foundText: foundMatch });
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
                        <button type="button" class="btn btn-secondary edit-btn" data-index="${r.index}">Cargar</button>
                    </div>
                `).join('');
            }
        };
        
        els.searchBtn.addEventListener('click', performSearch);
        els.searchType.addEventListener('change', updateSearchPlaceholder); 
        
        els.searchRef.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(performSearch, 300);
        });
        els.searchRef.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); clearTimeout(searchTimeout); performSearch(); }
        });
        // --- FIN BÚSQUEDA ---


        // Clic Cargar Resultados
        els.searchResults.addEventListener('click', (e) => {
            const targetButton = e.target.closest('.edit-btn');
            if (targetButton) {
                const indexStr = targetButton.dataset.index;
                if (indexStr) {
                     const index = parseInt(indexStr, 10);
                     if (!isNaN(index) && index >= 0 && Array.isArray(masterPadList) && index < masterPadList.length) {
                         loadPadDataIntoForms(masterPadList[index], index);
                     }
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

        // Guardar/Actualizar Pastilla
        els.savePadBtn.addEventListener('click', () => {
            const isMedidasValid = validateField(els.padMedidas, medidasRegex);
            if (!isMedidasValid) {
                 showStatus(els.savePadStatus, "El formato de Medidas es incorrecto. Debe ser '100 x 50' o '100 x 50, 110 x 60'.", true, 5000);
                 els.padMedidas.focus();
                 return;
            }

            const refsValue = els.padRef.value || '';
            const refsArray = refsValue.split(',').map(s => s.trim()).filter(Boolean);

            if (refsArray.length === 0) {
                showStatus(els.savePadStatus, "La Referencia (ID) es obligatoria.", true);
                if(els.padRef.focus) els.padRef.focus();
                return;
            }
            
            showStatus(els.savePadStatus, "", false, 1); 

            const newPad = {
                ref: refsArray,
                oem: (els.padOem?.value || '').split(',').map(s => s.trim()).filter(Boolean),
                fmsi: (els.padFmsi?.value || '').split(',').map(s => s.trim()).filter(Boolean),
                posición: els.padPosicion?.value || 'Delantera',
                medidas: (els.padMedidas?.value || '').split(',').map(s => s.trim()).filter(Boolean),
                imagenes: (els.padImagenes?.value || '').split(',').map(s => s.trim()).filter(Boolean),
                aplicaciones: Array.isArray(currentApps) ? currentApps : [],
            };

            let message = "";
            if (!Array.isArray(masterPadList)) masterPadList = [];

            if (editIndex > -1 && editIndex < masterPadList.length) {
                masterPadList[editIndex] = newPad;
                message = `¡Pastilla "${refsArray[0]}" actualizada!`;
            } else {
                masterPadList.push(newPad);
                message = `¡Pastilla "${refsArray[0]}" guardada!`;
            }
            
            generateAutocompleteData(masterPadList);
            updateMarcaDatalist();

            updateDashboardStats();
            resetFormsAndMode();
            setActiveSection('dashboard');
            showStatus(els.importStatus, message, false); 
        });
        
        // --- LISTENER: ELIMINAR PASTILLA ---
        els.deletePadBtn.addEventListener('click', async () => {
            if (editIndex < 0 || !Array.isArray(masterPadList) || editIndex >= masterPadList.length) {
                showStatus(els.savePadStatus, "No hay pastilla válida cargada para eliminar.", true);
                return;
            }

            const padToRemove = masterPadList[editIndex];
            const refId = (padToRemove?.ref?.[0] || 'esta pastilla');
            const message = `¿Estás SEGURO de eliminar la pastilla "${refId}"? Esta acción es permanente.`;
            
            const confirmed = await showCustomConfirm(message, "Eliminar Pastilla", "Sí, Eliminar", "btn-danger");
            
            if (confirmed) {
                masterPadList.splice(editIndex, 1); 
                
                generateAutocompleteData(masterPadList);
                updateMarcaDatalist();

                showStatus(els.importStatus, `Pastilla "${refId}" eliminada.`, false);
                updateDashboardStats();
                resetFormsAndMode();
                setActiveSection('dashboard');
            }
        });

        // --- LISTENER: DUPLICAR PASTILLA ---
        els.duplicatePadBtn.addEventListener('click', () => {
            if (editIndex < 0) { 
                showStatus(els.savePadStatus, "Carga una pastilla primero para duplicarla.", true);
                return;
            }
            
            editIndex = -1;
            if (els.editIndexInput) els.editIndexInput.value = "-1";
            
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
                imagePreviewTimeout = setTimeout(renderImagePreview, 300); // 300ms debounce
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


        // Generar y Descargar JSON
        els.generateDownloadBtn.addEventListener('click', () => {
            const jsonString = generateJsonString();
            displayFormattedJson(jsonString); 

            if (!Array.isArray(masterPadList) || masterPadList.length === 0) {
                showStatus(els.downloadStatus, "No hay datos cargados para generar.", true);
                return;
            }
            try {
                const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = 'data.json';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 100);
                showStatus(els.downloadStatus, `data.json (${masterPadList.length} pastillas) generado.`, false);
            } catch (err) {
                console.error("Error descarga Blob:", err);
                showStatus(els.downloadStatus, `Error descarga: ${err.message}`, true);
            }
        });
        
        // EXPORTAR A EXCEL
        els.exportExcelBtn.addEventListener('click', exportToExcel);

        // Copiar JSON
        els.copyJsonBtn.addEventListener('click', () => {
            const jsonToCopy = els.jsonOutput.value;
             if (!jsonToCopy || jsonToCopy.length === 0 || jsonToCopy === '[]') {
                showStatus(els.copyStatus, "No hay JSON en vista previa.", true);
                return;
            }
            navigator.clipboard.writeText(jsonToCopy)
                .then(() => showStatus(els.copyStatus, "¡JSON (formateado) copiado!", false))
                .catch(err => {
                    console.error("Error copia Clipboard:", err);
                    showStatus(els.copyStatus, `Error copia: ${err.message}.`, true);
                });
        });

        // Limpiar Sesión
        els.clearAllBtn.addEventListener('click', async () => {
            const message = "¿Estás SEGURO de que quieres borrar todos los datos de esta sesión? Esta acción no se puede deshacer.";
            const confirmed = await showCustomConfirm(message, "Limpiar Sesión", "Sí, Limpiar Todo", "btn-danger");
            if (confirmed) {
                masterPadList = [];
                generateAutocompleteData([]); 
                updateMarcaDatalist(); 
                resetFormsAndMode();
                updateDashboardStats();
                if (els.jsonOutput) els.jsonOutput.value = '';
                if (els.fileName) els.fileName.textContent = 'Ningún archivo seleccionado.';
                if (els.fileImport) els.fileImport.value = '';
                showStatus(els.importStatus, "Sesión limpiada.", false);
                setActiveSection('dashboard');
            }
        });

        // Modo Oscuro
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

    // ----- INICIALIZAR UI -----
    try {
        setActiveSection('dashboard');
        updateDashboardStats();
        updateSearchPlaceholder(); 
        console.log("Admin panel UI inicializado.");
    } catch (error) {
        console.error("Error al inicializar UI:", error);
    }

}); // Fin DOMContentLoaded
