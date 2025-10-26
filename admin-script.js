document.addEventListener('DOMContentLoaded', () => {
    console.log("Admin script loaded. DOM ready.");

    // ----- VARIABLES GLOBALES -----
    let masterPadList = [];
    let currentApps = [];
    let editIndex = -1;
    let editingAppIndex = -1;
    let totalAppsInList = 0;

    // ----- DOM ELEMENTS -----
    let els = {};
    try {
        console.log("Attempting to obtain DOM elements...");
        els = {
            navItems: document.querySelectorAll('.nav-item'),
            contentSections: document.querySelectorAll('.content-section'),
            pageTitle: document.getElementById('page-title'),
            padCountDashboard: document.getElementById('pad-count-dashboard'),
            appsTotalDashboard: document.getElementById('apps-total-dashboard'),
            fileImport: document.getElementById('file-import'),
            fileName: document.getElementById('file-name'),
            importStatus: document.getElementById('import-status'),
            searchRef: document.getElementById('search-ref'),
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
            jsonOutput: document.getElementById('json-output'),
            generateDownloadBtn: document.getElementById('generate-download-btn'),
            downloadStatus: document.getElementById('download-status'),
            copyJsonBtn: document.getElementById('copy-json-btn'),
            copyStatus: document.getElementById('copy-status'),
            clearAllBtn: document.getElementById('clear-all-btn'),
            darkBtn: document.getElementById('darkBtn'),
            sunIcon: document.querySelector('.lp-icon-sun'),
            moonIcon: document.querySelector('.lp-icon-moon'),
        };
        if (!els.pageTitle || !els.navItems || !els.contentSections || !els.padRef) {
             throw new Error("Elementos esenciales del layout o formulario no encontrados.");
        }
        console.log("DOM elements obtained successfully.");
    } catch (error) {
        console.error("Error obtaining DOM elements:", error);
        alert("Error crítico: No se encontraron elementos HTML necesarios. Revisa IDs y la consola (F12).");
        return;
    }

    // ----- FUNCIONES -----

    const setActiveSection = (sectionId) => {
        if (!sectionId || typeof sectionId !== 'string') {
            console.warn("setActiveSection llamada sin un ID de sección válido:", sectionId);
            return;
        }

        els.contentSections?.forEach(section => {
            section.classList.remove('active');
        });

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
                if (titleSpan) {
                     els.pageTitle.textContent = titleSpan.textContent || 'Admin Panel';
                }
            }
        } else {
            console.error(`Sección con ID '${sectionId}' no encontrada. Volviendo a dashboard.`);
            const dashboardSection = document.getElementById('dashboard');
            if (dashboardSection) {
                 dashboardSection.classList.add('active');
                 els.navItems?.forEach(item => {
                     if (item.dataset && typeof item.dataset.section !== 'undefined') {
                         item.classList.toggle('active', item.dataset.section === 'dashboard');
                     }
                 });
                 if(els.pageTitle){
                     const dashboardNavItem = document.querySelector(`.nav-item[data-section="dashboard"] span:last-child`);
                     if(dashboardNavItem) els.pageTitle.textContent = dashboardNavItem.textContent || 'Dashboard';
                 }
            } else {
                 console.error("¡Sección de Dashboard tampoco encontrada!");
            }
        }
    };

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
    };

    const resetFormsAndMode = () => {
        if (els.padFormMain) els.padFormMain.reset();
        if (els.editIndexInput) els.editIndexInput.value = "-1";
        editIndex = -1;
        currentApps = [];

        if (els.formModeTitle) els.formModeTitle.textContent = "Añadir Nueva Pastilla";
        if (els.saveButtonText) els.saveButtonText.textContent = "Guardar Pastilla";
        if (els.savePadBtn) {
            els.savePadBtn.classList.remove('btn-secondary');
            els.savePadBtn.classList.add('btn-primary');
        }

        if (els.searchRef) els.searchRef.value = '';
        if (els.searchResults) els.searchResults.innerHTML = '';
        if (els.clearSearchBtn) els.clearSearchBtn.style.display = 'none';

        resetAppForm();
        renderCurrentApps();
    };

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

    const showStatus = (element, message, isError = false, duration = 4000) => {
        if (!element) {
             console.warn("showStatus: Elemento no encontrado:", message);
             return;
        }
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

    // --- ¡CAMBIO AQUÍ! ---
    // Genera JSON compacto PERO con un salto de línea entre objetos
    const generateJsonString = () => {
        if (!Array.isArray(masterPadList) || masterPadList.length === 0) return '[]';
        const sortedList = [...masterPadList];

        sortedList.sort((a, b) => {
            const refA_id = (a?.ref?.[0] || '').toLowerCase();
            const refB_id = (b?.ref?.[0] || '').toLowerCase();
            return refA_id.localeCompare(refB_id, undefined, { numeric: true, sensitivity: 'base' });
        });

        try {
            // 1. Convertir a JSON compacto (una sola línea)
            const compactJson = JSON.stringify(sortedList);
            
            // 2. Reemplazar "},{
            //    con "},
            //    {"
            // Esto crea el formato de un objeto por línea.
            const formattedJson = compactJson.replace(/},{/g, '},\n{');
            
            return formattedJson;

        } catch (err) {
            console.error("Error stringifying data:", err);
            showStatus(els.downloadStatus, `Error interno al generar JSON: ${err.message}`, true);
            return '[]';
        }
    };

    // Muestra JSON "bonito" (indentado) en el textarea
    const displayFormattedJson = (jsonString) => {
        if (!els.jsonOutput) return;
        try {
            // Aunque el string de entrada pueda tener saltos de línea,
            // lo parseamos y lo re-formateamos con indentación para la vista previa.
            const parsedData = JSON.parse(jsonString);
            els.jsonOutput.value = JSON.stringify(parsedData, null, 2);
        } catch (e) {
            console.error("Error formatting JSON for display:", e);
            els.jsonOutput.value = jsonString; // Muestra el original (con saltos de línea) si falla
        }
    };

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
             const anio = app?.año || ''; // Leer 'año'
             const espec = app?.especificacion || ''; // Leer 'especificacion'
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

    const loadAppDataIntoForm = (index) => {
        if (!Array.isArray(currentApps) || index < 0 || index >= currentApps.length) return;
        const app = currentApps[index];
        if (!app) return;

        editingAppIndex = index;
        if (els.editingAppIndexInput) els.editingAppIndexInput.value = index;

        if (els.appMarca) els.appMarca.value = app.marca || '';
        if (els.appSerie) els.appSerie.value = app.serie || '';
        if (els.appLitros) els.appLitros.value = app.litros || '';
        if (els.appAnio) els.appAnio.value = app.año || ''; // Leer 'año'
        if (els.appEspec) els.appEspec.value = app.especificacion || ''; // Leer 'especificacion'

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
        if (els.padPosicion) els.padPosicion.value = padData.posición || 'Delantera'; // Leer 'posición'
        if (els.padMedidas) els.padMedidas.value = padData.medidas || '';
        if (els.padImagenes) els.padImagenes.value = (Array.isArray(padData.imagenes) ? padData.imagenes : []).join(', '); // Leer 'imagenes'

        currentApps = Array.isArray(padData.aplicaciones) ? JSON.parse(JSON.stringify(padData.aplicaciones)) : [];

        const firstRefId = (Array.isArray(padData.ref) && padData.ref.length > 0) ? padData.ref[0] : '';
        if (els.formModeTitle) els.formModeTitle.textContent = `Editando Pastilla: ${firstRefId}`;
        if (els.saveButtonText) els.saveButtonText.textContent = "Actualizar Pastilla";
        if (els.savePadBtn) {
            els.savePadBtn.classList.remove('btn-primary');
            els.savePadBtn.classList.add('btn-primary');
        }

        if (els.clearSearchBtn) els.clearSearchBtn.style.display = 'inline-flex';
        if (els.searchResults) els.searchResults.innerHTML = '';

        renderCurrentApps();
        resetAppForm();

        setActiveSection('edit-pad');
        if (els.padRef) els.padRef.focus();
    };

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

    // ----- EVENT LISTENERS -----
    try {
        console.log("Adding event listeners...");

        // Navegación
        els.navItems?.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset?.section;
                if (section) setActiveSection(section);
                else console.warn("Nav item missing data-section:", item);
            });
        });

        // Carga Archivo
        if (els.fileImport) {
            els.fileImport.addEventListener('change', (e) => {
                const file = e.target.files?.[0];
                if (!file) {
                    if (els.fileName) els.fileName.textContent = "Ningún archivo seleccionado.";
                    return;
                }
                if (els.fileName) els.fileName.textContent = file.name;
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const result = event.target?.result;
                        if (typeof result !== 'string') throw new Error("Contenido no es texto.");
                        const data = JSON.parse(result);
                        if (!Array.isArray(data)) throw new Error("JSON no es array.");
                        masterPadList = data;
                        updateDashboardStats();
                        showStatus(els.importStatus, `¡Éxito! ${masterPadList.length} pastillas cargadas.`, false);
                        resetFormsAndMode();
                        if (els.jsonOutput) els.jsonOutput.value = '';
                    } catch (err) {
                        console.error("Error procesando JSON:", err);
                        showStatus(els.importStatus, `Error: ${err.message}`, true);
                        masterPadList = [];
                        updateDashboardStats();
                        if (els.fileName) els.fileName.textContent = file.name + " (Error)";
                        if (els.jsonOutput) els.jsonOutput.value = '';
                    } finally { if (e.target) e.target.value = null; }
                };
                reader.onerror = (error) => {
                    console.error("Error leyendo archivo:", error);
                    showStatus(els.importStatus, "Error al leer archivo.", true);
                     if (els.fileName) els.fileName.textContent = file.name + " (Error lectura)";
                     if (e.target) e.target.value = null;
                };
                reader.readAsText(file, 'UTF-8');
            });
        } else { console.warn("Elemento fileImport no encontrado"); }

        // Búsqueda
        const performSearch = () => {
            if (!els.searchRef || !els.searchResults) return;
            const query = els.searchRef.value.trim().toLowerCase();

            if (query.length < 1) { 
                els.searchResults.innerHTML = '<div class="search-feedback error">Escribe al menos 1 carácter.</div>';
                if (query.length === 0) {
                     els.searchResults.innerHTML = '';
                }
                return;
            }

            if (!Array.isArray(masterPadList) || masterPadList.length === 0) {
                els.searchResults.innerHTML = '<div class="search-feedback error">Carga datos primero.</div>';
                return;
            }

            const results = masterPadList.reduce((acc, pad, index) => {
                if (Array.isArray(pad?.ref)) {
                     const foundRefString = pad.ref.find(r => typeof r === 'string' && r.toLowerCase().includes(query));
                     if (foundRefString) {
                         acc.push({ pad, index, foundRef: foundRefString });
                     }
                 }
                 return acc;
            }, []); 


            if (results.length === 0) {
                els.searchResults.innerHTML = `<div class="search-feedback">No se encontró nada para "${query}".</div>`;
            } else {
                els.searchResults.innerHTML = results.map(r => `
                    <div class="search-result-item">
                        <div>
                            <span class="search-result-ref">${r.foundRef}</span>
                            <span class="search-result-apps">(${(Array.isArray(r.pad?.aplicaciones) ? r.pad.aplicaciones.length : 0)} apps)</span>
                        </div>
                        <button type="button" class="btn btn-secondary edit-btn" data-index="${r.index}">Cargar</button>
                    </div>
                `).join('');
            }
        };
        if(els.searchBtn) els.searchBtn.addEventListener('click', performSearch);
        if(els.searchRef) {
            let searchTimeout;
            els.searchRef.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(performSearch, 300);
            });
            els.searchRef.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); clearTimeout(searchTimeout); performSearch(); }
            });
        } else { console.warn("Elementos searchBtn o searchRef no encontrados"); }

        // Clic Cargar Resultados
        if(els.searchResults) {
            els.searchResults.addEventListener('click', (e) => {
                const targetButton = e.target.closest('.edit-btn');
                if (targetButton) {
                    const indexStr = targetButton.dataset.index;
                    if (indexStr) {
                         const index = parseInt(indexStr, 10);
                         if (!isNaN(index) && index >= 0 && Array.isArray(masterPadList) && index < masterPadList.length) {
                             loadPadDataIntoForms(masterPadList[index], index);
                         } else { console.warn("Índice inválido:", indexStr); }
                    } else { console.warn("Botón Cargar sin data-index."); }
                }
            });
        } else { console.warn("Elemento searchResults no encontrado"); }

        // Limpiar Form
        if(els.clearSearchBtn) els.clearSearchBtn.addEventListener('click', resetFormsAndMode);
        else { console.warn("Elemento clearSearchBtn no encontrado"); }

        // Form App Submit
        if (els.appForm) {
            els.appForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (!els.appMarca || !els.appSerie) return;

                const app = {
                    marca: els.appMarca.value.trim(),
                    serie: els.appSerie.value.trim(),
                    litros: els.appLitros?.value.trim() || '',
                    año: els.appAnio?.value.trim() || '', // Guardar 'año' (con tilde)
                    especificacion: els.appEspec?.value.trim() || '', // Guardar 'especificacion'
                };

                if (!app.marca || !app.serie) {
                    alert("Marca y Serie son obligatorios.");
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
        } else { console.warn("Elemento appForm no encontrado"); }

        // Cancelar Edit App
        if(els.cancelEditAppBtn) els.cancelEditAppBtn.addEventListener('click', resetAppForm);
        else { console.warn("Elemento cancelEditAppBtn no encontrado"); }

        // Clics Lista Apps
        if (els.currentAppsList) {
            els.currentAppsList.addEventListener('click', (e) => {
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
                    if (appToRemove && confirm(`¿Eliminar "${appToRemove.marca || ''} ${appToRemove.serie || ''}"?`)) {
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
        } else { console.warn("Elemento currentAppsList no encontrado"); }

        // Guardar Pastilla
        if (els.savePadBtn) {
            els.savePadBtn.addEventListener('click', () => {
                 if (!els.padRef) { alert("Error: Campo Ref no encontrado."); return; }
                const refsValue = els.padRef.value || '';
                const refsArray = refsValue.split(',').map(s => s.trim()).filter(Boolean);

                if (refsArray.length === 0) {
                    alert("La Referencia (ID) es obligatoria.");
                    if(els.padRef.focus) els.padRef.focus();
                    return;
                }

                const newPad = {
                    ref: refsArray,
                    oem: (els.padOem?.value || '').split(',').map(s => s.trim()).filter(Boolean),
                    fmsi: (els.padFmsi?.value || '').split(',').map(s => s.trim()).filter(Boolean),
                    posición: els.padPosicion?.value || 'Delantera', // Guardar 'posición' (con tilde)
                    medidas: (els.padMedidas?.value || '').trim(),
                    imagenes: (els.padImagenes?.value || '').split(',').map(s => s.trim()).filter(Boolean), // Guardar 'imagenes' (plural)
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

                updateDashboardStats();
                resetFormsAndMode();
                setActiveSection('dashboard');
                showStatus(els.importStatus, message, false);
            });
        } else { console.warn("Elemento savePadBtn no encontrado"); }

        // Generar y Descargar JSON
        if (els.generateDownloadBtn) {
            els.generateDownloadBtn.addEventListener('click', () => {
                const jsonString = generateJsonString(); // Compacto con saltos de línea
                displayFormattedJson(jsonString); // Muestra formateado en textarea

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
        } else { console.warn("Elemento generateDownloadBtn no encontrado"); }


        // Copiar JSON
        if (els.copyJsonBtn && els.jsonOutput) {
            els.copyJsonBtn.addEventListener('click', () => {
                const jsonToCopy = els.jsonOutput.value; // Copia el JSON "bonito" del textarea
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
        } else { console.warn("Elementos copyJsonBtn o jsonOutput no encontrados"); }

        // Limpiar Sesión
        if (els.clearAllBtn) {
            els.clearAllBtn.addEventListener('click', () => {
                if (confirm("¿Borrar datos de sesión? No afecta el archivo guardado.")) {
                    masterPadList = [];
                    resetFormsAndMode();
                    updateDashboardStats();
                    if (els.jsonOutput) els.jsonOutput.value = '';
                    if (els.fileName) els.fileName.textContent = 'Ningún archivo seleccionado.';
                    if (els.fileImport) els.fileImport.value = '';
                    showStatus(els.importStatus, "Sesión limpiada.", false);
                    setActiveSection('dashboard');
                }
            });
        } else { console.warn("Elemento clearAllBtn no encontrado"); }

        // Modo Oscuro
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
        } else { console.warn("Elemento darkBtn no encontrado"); }

        console.log("Todos los event listeners configurados.");

    } catch (error) {
        console.error("Error crítico añadiendo listeners:", error);
        alert("Error crítico al inicializar. Revisa consola (F12).");
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
        console.log("Admin panel UI inicializado.");
    } catch (error) {
        console.error("Error al inicializar UI:", error);
        alert("Error al inicializar interfaz.");
    }

}); // Fin DOMContentLoaded