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
            // Dark Mode Elements
            darkBtn: document.getElementById('darkBtn'),
            sunIcon: document.querySelector('.lp-icon-sun'),
            moonIcon: document.querySelector('.lp-icon-moon'),
        };
        // Verificación básica de que los elementos existen
        if (!els.pageTitle || !els.navItems || !els.contentSections) {
             throw new Error("Elementos esenciales del layout no encontrados.");
        }
        console.log("DOM elements obtained successfully.");
    } catch (error) {
        console.error("Error obtaining DOM elements:", error);
        alert("Error crítico: No se encontraron elementos HTML necesarios. Revisa IDs y la consola (F12).");
        return; // Detiene la ejecución si faltan elementos clave
    }

    // ----- FUNCIONES -----

    const setActiveSection = (sectionId) => {
        if (!sectionId || typeof sectionId !== 'string') { // Validación de entrada
            console.warn("setActiveSection llamada sin un ID de sección válido:", sectionId);
            return;
        }

        els.contentSections?.forEach(section => {
            section.classList.remove('active');
        });

        els.navItems?.forEach(item => {
            // Asegurarse que item.dataset existe y tiene la propiedad section
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
                     els.pageTitle.textContent = titleSpan.textContent || 'Admin'; // Fallback title
                }
            }
        } else {
            console.error(`Sección con ID '${sectionId}' no encontrada. Volviendo a dashboard.`);
            // Intenta volver a dashboard de forma segura
            const dashboardSection = document.getElementById('dashboard');
            if (dashboardSection) {
                 dashboardSection.classList.add('active');
                 // Actualiza el item de navegación también
                 els.navItems?.forEach(item => {
                     if (item.dataset && typeof item.dataset.section !== 'undefined') {
                         item.classList.toggle('active', item.dataset.section === 'dashboard');
                     }
                 });
                 if(els.pageTitle){ // Actualiza titulo
                     const dashboardNavItem = document.querySelector(`.nav-item[data-section="dashboard"] span:last-child`);
                     if(dashboardNavItem) els.pageTitle.textContent = dashboardNavItem.textContent || 'Dashboard';
                 }

            } else {
                 console.error("¡Sección de Dashboard tampoco encontrada!");
                 // Podrías mostrar un error al usuario aquí
            }
        }
    };

    const resetAppForm = () => {
        if (els.appForm) els.appForm.reset();
        if (els.editingAppIndexInput) els.editingAppIndexInput.value = "-1";
        editingAppIndex = -1;
        if (els.addAppButtonText) els.addAppButtonText.textContent = "Añadir App";
        if (els.addUpdateAppBtn) {
            els.addUpdateAppBtn.classList.remove('btn-secondary'); // secondary is now outline
            els.addUpdateAppBtn.classList.add('btn-tertiary'); // tertiary is green
        }
        if (els.cancelEditAppBtn) els.cancelEditAppBtn.style.display = 'none';
        if (els.appFormDescription) els.appFormDescription.textContent = "Añade vehículos compatibles.";
    };

    const resetFormsAndMode = () => {
        if (els.padFormMain) els.padFormMain.reset();
        if (els.editIndexInput) els.editIndexInput.value = "-1";
        editIndex = -1;
        currentApps = []; // Resetea la lista de apps temporal

        if (els.formModeTitle) els.formModeTitle.textContent = "Añadir Nueva Pastilla";
        if (els.saveButtonText) els.saveButtonText.textContent = "Guardar Pastilla";
        if (els.savePadBtn) {
            els.savePadBtn.classList.remove('btn-secondary'); // Ensure it's not outline
            els.savePadBtn.classList.add('btn-primary'); // primary is blue
        }

        if (els.searchRef) els.searchRef.value = '';
        if (els.searchResults) els.searchResults.innerHTML = '';
        if (els.clearSearchBtn) els.clearSearchBtn.style.display = 'none';

        resetAppForm(); // Llama a resetear el form de apps
        renderCurrentApps(); // Actualiza la lista de apps (mostrará "Ninguna")
    };

    const calculateTotalApps = () => {
        if (!Array.isArray(masterPadList)) return 0; // Asegurarse que es un array
        return masterPadList.reduce((total, pad) => {
             // Verificar que pad sea un objeto y tenga 'aplicaciones' como array
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
             console.warn("showStatus: Elemento no encontrado para mostrar mensaje:", message);
             return;
        }
        element.textContent = message;
        element.className = 'status-message'; // Reset classes first
        element.classList.add(isError ? 'error' : 'success');

        // Clear previous timeout if exists to prevent message flickering
        if (element.timeoutId) {
             clearTimeout(element.timeoutId);
        }

        element.timeoutId = setTimeout(() => {
            if(element) { // Check if element still exists
                 element.textContent = '';
                 element.className = 'status-message';
                 delete element.timeoutId; // Clean up the property
            }
        }, duration);
    };

    const generateJsonString = () => {
        if (!Array.isArray(masterPadList) || masterPadList.length === 0) return '[]';

        // Crear una copia antes de ordenar
        const sortedList = [...masterPadList];

        sortedList.sort((a, b) => {
            // Manejo defensivo por si 'ref' no existe o no es array o no es string
            const refA = (a && Array.isArray(a.ref) && a.ref.length > 0 && typeof a.ref[0] === 'string') ? a.ref[0].toLowerCase() : '';
            const refB = (b && Array.isArray(b.ref) && b.ref.length > 0 && typeof b.ref[0] === 'string') ? b.ref[0].toLowerCase() : '';
            // localeCompare con options para manejar números dentro de strings mejor
            return refA.localeCompare(refB, undefined, { numeric: true, sensitivity: 'base' });
        });

        try {
            // Siempre generar compacto para la descarga
            const compactJson = JSON.stringify(sortedList);
            return compactJson;
        } catch (err) {
            console.error("Error al convertir a JSON:", err);
            showStatus(els.downloadStatus, `Error interno al generar JSON: ${err.message}`, true);
            return '[]'; // Devuelve array vacío en caso de error
        }
    };

    // Función para mostrar el JSON formateado en el textarea
    const displayFormattedJson = (compactJsonString) => {
        if (!els.jsonOutput) return;
        try {
            // Intenta parsear el JSON compacto y luego re-stringify con formato
            const parsedData = JSON.parse(compactJsonString);
            els.jsonOutput.value = JSON.stringify(parsedData, null, 2); // Formateado con 2 espacios
        } catch (e) {
             console.error("Error formateando JSON para vista previa:", e);
            // Si falla (ej. si ya era '[]' o inválido), muestra el string original
            els.jsonOutput.value = compactJsonString;
        }
    };


    const renderCurrentApps = () => {
        if (!els.currentAppsList) return;

        if (!Array.isArray(currentApps) || currentApps.length === 0) {
            els.currentAppsList.innerHTML = '<li class="empty-list">Ninguna todavía</li>';
            return;
        }

        els.currentAppsList.innerHTML = currentApps.map((app, index) => {
             // Comprobaciones defensivas para los datos de 'app'
            const marca = app?.marca || '';
            const serie = app?.serie || '';
            const litros = app?.litros || '';
            const anio = app?.anio || '';
            const espec = app?.espec || '';
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
                </li>
            `;
            }).join('');
    };


    const loadAppDataIntoForm = (index) => {
        if (!Array.isArray(currentApps) || index < 0 || index >= currentApps.length) {
            console.warn("loadAppDataIntoForm: Índice inválido o lista de apps no es array");
            return;
        }
        const app = currentApps[index];
        if (!app) {
             console.warn("loadAppDataIntoForm: No se encontró la app en el índice", index);
             return;
        }


        editingAppIndex = index;
        if (els.editingAppIndexInput) els.editingAppIndexInput.value = index;

        if (els.appMarca) els.appMarca.value = app.marca || '';
        if (els.appSerie) els.appSerie.value = app.serie || '';
        if (els.appLitros) els.appLitros.value = app.litros || '';
        if (els.appAnio) els.appAnio.value = app.anio || '';
        if (els.appEspec) els.appEspec.value = app.espec || '';

        if (els.addAppButtonText) els.addAppButtonText.textContent = "Actualizar App";
        if (els.addUpdateAppBtn) {
             // Secondary in Fluent is outline, use Tertiary (green) for add, Primary (blue) for update?
             // Let's stick to Green for Add, Blue for Update
             els.addUpdateAppBtn.classList.remove('btn-tertiary');
             els.addUpdateAppBtn.classList.add('btn-primary'); // Use primary (blue) for Update
        }
        if (els.cancelEditAppBtn) els.cancelEditAppBtn.style.display = 'inline-flex';
        if (els.appFormDescription) els.appFormDescription.textContent = `Editando: ${app.marca || ''} ${app.serie || ''}`;

        if (els.appMarca) els.appMarca.focus();
    };

    const loadPadDataIntoForms = (padData, index) => {
         if (!padData || typeof padData !== 'object') {
             console.error("loadPadDataIntoForms: padData inválido");
             return;
         }
        editIndex = index;
        if (els.editIndexInput) els.editIndexInput.value = index;

        // Asignaciones seguras
        if (els.padRef) els.padRef.value = (Array.isArray(padData.ref) ? padData.ref : []).join(', ');
        if (els.padOem) els.padOem.value = (Array.isArray(padData.oem) ? padData.oem : []).join(', ');
        if (els.padFmsi) els.padFmsi.value = (Array.isArray(padData.fmsi) ? padData.fmsi : []).join(', ');
        if (els.padPosicion) els.padPosicion.value = padData.posicion || 'Delantera';
        if (els.padMedidas) els.padMedidas.value = padData.medidas || '';
        if (els.padImagenes) els.padImagenes.value = (Array.isArray(padData.img) ? padData.img : []).join(', ');

        currentApps = Array.isArray(padData.aplicaciones) ? JSON.parse(JSON.stringify(padData.aplicaciones)) : [];

        const firstRef = (Array.isArray(padData.ref) && padData.ref.length > 0) ? padData.ref[0] : '';
        if (els.formModeTitle) els.formModeTitle.textContent = `Editando Pastilla: ${firstRef}`;
        if (els.saveButtonText) els.saveButtonText.textContent = "Actualizar Pastilla";
        if (els.savePadBtn) {
            els.savePadBtn.classList.remove('btn-primary'); // Remove blue
            els.savePadBtn.classList.add('btn-primary'); // Keep blue for Update (as primary action here)
        }

        if (els.clearSearchBtn) els.clearSearchBtn.style.display = 'inline-flex';
        if (els.searchResults) els.searchResults.innerHTML = '';

        renderCurrentApps();
        resetAppForm(); // Ensure app form is reset when loading a pad

        setActiveSection('edit-pad');
        if (els.padRef) els.padRef.focus();
    };

    const createRippleEffect = (event) => {
        const button = event.currentTarget;
        // Ensure it's a button or element that should ripple
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
        if (existingRipple) {
            existingRipple.remove();
        }

        // Prepend instead of append to be behind the text/icon potentially
        button.insertBefore(circle, button.firstChild);


        circle.addEventListener('animationend', () => {
            if (circle.parentNode) {
                 circle.remove();
            }
        }, { once: true });
    };

    // ----- EVENT LISTENERS -----
    try {
        console.log("Adding event listeners...");

        // Navegación principal
        els.navItems?.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset?.section;
                if (section) {
                    setActiveSection(section);
                } else {
                     console.warn("Nav item no tiene data-section:", item);
                }
            });
        });

        // Carga de archivo JSON
        if (els.fileImport) {
            els.fileImport.addEventListener('change', (e) => {
                const file = e.target.files?.[0];
                if (!file) {
                    if (els.fileName) els.fileName.textContent = "Ningún archivo seleccionado.";
                    // Optionally reset masterPadList if no file is selected after one was loaded
                    // masterPadList = []; updateDashboardStats(); showStatus(...)
                    return;
                }
                if (els.fileName) els.fileName.textContent = file.name;

                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const result = event.target?.result;
                        if (typeof result !== 'string') throw new Error("Contenido del archivo no es texto.");
                        const data = JSON.parse(result);
                        if (!Array.isArray(data)) throw new Error("El JSON no es un array.");

                        masterPadList = data;
                        updateDashboardStats();
                        showStatus(els.importStatus, `¡Éxito! Se cargaron ${masterPadList.length} pastillas.`, false);
                        console.log("Datos JSON cargados:", masterPadList);
                        // Limpiar resultados de búsqueda y formulario si se carga un nuevo archivo
                        resetFormsAndMode();
                        if (els.jsonOutput) els.jsonOutput.value = ''; // Limpiar vista previa JSON
                    } catch (err) {
                        console.error("Error al procesar JSON:", err);
                        showStatus(els.importStatus, `Error: ${err.message}`, true);
                        masterPadList = []; // Resetear en caso de error
                        updateDashboardStats();
                        if (els.fileName) els.fileName.textContent = file.name + " (Error)"; // Indicate error
                        if (els.jsonOutput) els.jsonOutput.value = ''; // Limpiar vista previa JSON
                    } finally {
                        // Limpiar el valor del input file para permitir cargar el mismo archivo de nuevo
                         e.target.value = null;
                    }
                };
                reader.onerror = (error) => {
                    console.error("Error al leer el archivo:", error);
                    showStatus(els.importStatus, "Error: No se pudo leer el archivo.", true);
                     if (els.fileName) els.fileName.textContent = file.name + " (Error lectura)";
                     e.target.value = null; // Limpiar input
                };
                reader.readAsText(file, 'UTF-8'); // Especificar UTF-8
            });
        } else { console.warn("Elemento fileImport no encontrado"); }


        // Búsqueda de pastilla
        const performSearch = () => {
             if (!els.searchRef || !els.searchResults) return;
             const query = els.searchRef.value.trim().toLowerCase();

             if (query.length < 2) {
                 // Clear results if query is too short or empty
                 els.searchResults.innerHTML = '<div class="search-feedback error">Escribe al menos 2 caracteres.</div>';
                 return;
             }
             if (!Array.isArray(masterPadList) || masterPadList.length === 0) {
                 els.searchResults.innerHTML = '<div class="search-feedback error">Carga o inicializa datos primero.</div>';
                 return;
             }

             const results = masterPadList.reduce((acc, pad, index) => {
                 const refs = (Array.isArray(pad?.ref) ? pad.ref : []).filter(r => typeof r === 'string');
                 const foundRef = refs.find(r => r.toLowerCase().includes(query));

                 if (foundRef) {
                      // Usar Set para evitar duplicados si la misma pastilla coincide múltiples veces
                      acc.add({ pad, index, foundRef: foundRef });
                 }
                 return acc;
             }, new Set()); // Usar Set para resultados únicos por índice

              const uniqueResults = Array.from(results); // Convertir Set a Array

             if (uniqueResults.length === 0) {
                 els.searchResults.innerHTML = `<div class="search-feedback">No se encontró nada para "${query}".</div>`;
             } else {
                 els.searchResults.innerHTML = uniqueResults.map(r => `
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
            els.searchRef.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); performSearch(); } });
            els.searchRef.addEventListener('input', performSearch); // Buscar mientras se escribe
        }
        else { console.warn("Elementos searchBtn o searchRef no encontrados"); }


        // Clic en "Cargar" de resultados
        if(els.searchResults) {
            els.searchResults.addEventListener('click', (e) => {
                const targetButton = e.target.closest('.edit-btn');
                if (targetButton) {
                    const indexStr = targetButton.dataset.index;
                    if (indexStr) {
                         const index = parseInt(indexStr, 10);
                         if (!isNaN(index) && index >= 0 && Array.isArray(masterPadList) && index < masterPadList.length) {
                             const padData = masterPadList[index];
                             if (padData) {
                                 loadPadDataIntoForms(padData, index);
                                 // Opcional: limpiar búsqueda después de cargar
                                 // if (els.searchRef) els.searchRef.value = '';
                                 // if (els.searchResults) els.searchResults.innerHTML = '';
                             } else { console.warn("PadData no encontrado en índice:", index); }
                         } else { console.warn("Índice inválido o fuera de rango:", indexStr); }
                    } else { console.warn("Botón Cargar no tiene data-index."); }
                }
            });
        } else { console.warn("Elemento searchResults no encontrado"); }

        // Limpiar formulario y búsqueda
        if(els.clearSearchBtn) els.clearSearchBtn.addEventListener('click', resetFormsAndMode);
        else { console.warn("Elemento clearSearchBtn no encontrado"); }


        // Formulario de App (Submit)
        if (els.appForm) {
            els.appForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (!els.appMarca || !els.appSerie) {
                     alert("Error interno: Faltan campos de Marca/Serie.");
                     return;
                }

                const app = {
                    marca: els.appMarca.value.trim(),
                    serie: els.appSerie.value.trim(),
                    litros: els.appLitros?.value.trim() || '',
                    anio: els.appAnio?.value.trim() || '',
                    espec: els.appEspec?.value.trim() || '',
                };

                if (!app.marca || !app.serie) {
                    alert("Marca y Serie son obligatorios para la aplicación.");
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
                // Opcional: Mover el foco de nuevo al campo Marca para añadir otra rápidamente
                // if(els.appMarca) els.appMarca.focus();
            });
        } else { console.warn("Elemento appForm no encontrado"); }

        // Botón Cancelar Edición App
        if(els.cancelEditAppBtn) els.cancelEditAppBtn.addEventListener('click', resetAppForm);
        else { console.warn("Elemento cancelEditAppBtn no encontrado"); }


        // Clics en lista de Apps (Editar/Eliminar)
        if (els.currentAppsList) {
            els.currentAppsList.addEventListener('click', (e) => {
                const button = e.target.closest('.app-action-btn');
                if (!button) return;

                const indexStr = button.dataset.index;
                if (!indexStr) { console.warn("Botón de acción de app sin data-index"); return; }
                const index = parseInt(indexStr, 10);

                if (isNaN(index) || !Array.isArray(currentApps) || index < 0 || index >= currentApps.length) {
                     console.warn("Índice inválido o fuera de rango para acción de app:", indexStr);
                     return;
                }

                if (button.classList.contains('edit-app-btn')) {
                    loadAppDataIntoForm(index);
                } else if (button.classList.contains('remove-app-btn')) {
                    const appToRemove = currentApps[index];
                    if (appToRemove && confirm(`¿Seguro que quieres eliminar la aplicación "${appToRemove.marca || ''} ${appToRemove.serie || ''}"?`)) {
                        currentApps.splice(index, 1);
                        renderCurrentApps();

                        if (editingAppIndex === index) {
                            resetAppForm();
                        } else if (editingAppIndex > index) {
                            editingAppIndex--;
                            if (els.editingAppIndexInput) els.editingAppIndexInput.value = editingAppIndex;
                        }
                    }
                }
            });
        } else { console.warn("Elemento currentAppsList no encontrado"); }

        // Guardar Pastilla Principal
        if (els.savePadBtn) {
            els.savePadBtn.addEventListener('click', () => {
                 if (!els.padRef || !els.padOem || !els.padFmsi || !els.padPosicion || !els.padMedidas || !els.padImagenes) {
                     alert("Error: Faltan elementos del formulario principal.");
                     return;
                 }

                const refsValue = els.padRef.value || '';
                const refs = refsValue.split(',').map(s => s.trim()).filter(Boolean);

                if (refs.length === 0) {
                    alert("La Referencia es obligatoria.");
                    if(els.padRef.focus) els.padRef.focus();
                    return;
                }

                const newPad = {
                    ref: refs,
                    oem: (els.padOem.value || '').split(',').map(s => s.trim()).filter(Boolean),
                    fmsi: (els.padFmsi.value || '').split(',').map(s => s.trim()).filter(Boolean),
                    posicion: els.padPosicion.value || 'Delantera',
                    medidas: (els.padMedidas.value || '').trim(),
                    img: (els.padImagenes.value || '').split(',').map(s => s.trim()).filter(Boolean),
                    aplicaciones: Array.isArray(currentApps) ? currentApps : [],
                };

                let message = "";
                if (!Array.isArray(masterPadList)) masterPadList = [];

                if (editIndex > -1 && editIndex < masterPadList.length) {
                    masterPadList[editIndex] = newPad;
                    message = `¡Pastilla "${newPad.ref[0]}" actualizada!`;
                } else {
                    masterPadList.push(newPad);
                    message = `¡Pastilla "${newPad.ref[0]}" guardada!`;
                    // No necesitas actualizar editIndex aquí, se resetea en resetFormsAndMode
                }

                updateDashboardStats();
                resetFormsAndMode(); // Resetea todo, incluido editIndex
                setActiveSection('dashboard');
                showStatus(els.importStatus, message, false); // Status en dashboard
            });
        } else { console.warn("Elemento savePadBtn no encontrado"); }

        // Generar y Descargar JSON
        if (els.generateDownloadBtn) {
            els.generateDownloadBtn.addEventListener('click', () => {
                const jsonString = generateJsonString(); // Obtiene string compacto
                // Mostrar JSON formateado en el textarea INCLUSO si está vacío ('[]')
                displayFormattedJson(jsonString);

                if (jsonString === '[]') {
                    showStatus(els.downloadStatus, "No hay datos cargados para generar.", true);
                    return; // No intentar descargar un array vacío
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
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);

                    showStatus(els.downloadStatus, `data.json (${masterPadList.length} pastillas) generado y descargado.`, false);
                } catch (err) {
                    console.error("Error al crear/descargar Blob:", err);
                    showStatus(els.downloadStatus, `Error al descargar: ${err.message}`, true);
                }
            });
        } else { console.warn("Elemento generateDownloadBtn no encontrado"); }


        // Copiar JSON
        if (els.copyJsonBtn && els.jsonOutput) { // Asegurarse que ambos existen
            els.copyJsonBtn.addEventListener('click', () => {
                const jsonToCopy = els.jsonOutput.value; // Copia lo que está en el textarea
                 if (!jsonToCopy || jsonToCopy.length === 0 || jsonToCopy === '[]') {
                    showStatus(els.copyStatus, "No hay JSON generado en la vista previa para copiar.", true);
                    return;
                }

                navigator.clipboard.writeText(jsonToCopy)
                    .then(() => {
                        showStatus(els.copyStatus, "¡JSON (formateado) copiado!", false);
                    })
                    .catch(err => {
                        console.error("Error al copiar al portapapeles:", err);
                        showStatus(els.copyStatus, `Error al copiar: ${err.message}. Intenta manualmente.`, true);
                        // Fallback opcional seleccionando el texto
                        // els.jsonOutput.select();
                        // els.jsonOutput.setSelectionRange(0, 99999); // Para móviles
                    });
            });
        } else { console.warn("Elementos copyJsonBtn o jsonOutput no encontrados"); }

        // Limpiar Sesión
        if (els.clearAllBtn) {
            els.clearAllBtn.addEventListener('click', () => {
                if (confirm("¿Estás SEGURO de que quieres borrar todos los datos cargados en esta sesión? Esta acción NO se puede deshacer.")) {
                    masterPadList = [];
                    resetFormsAndMode();
                    updateDashboardStats();
                    if (els.jsonOutput) els.jsonOutput.value = '';
                    if (els.fileName) els.fileName.textContent = 'Ningún archivo seleccionado.';
                    if (els.fileImport) els.fileImport.value = '';
                    showStatus(els.importStatus, "Sesión limpiada. Puedes cargar un nuevo archivo.", false);
                    setActiveSection('dashboard');
                }
            });
        } else { console.warn("Elemento clearAllBtn no encontrado"); }

        // Botón Modo Oscuro
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

                try {
                    localStorage.setItem('darkModeAdminPref', isDark ? '1' : '0');
                } catch (storageError) {
                    console.warn("No se pudo guardar preferencia de modo oscuro:", storageError);
                }
            });
        } else { console.warn("Elemento darkBtn no encontrado"); }

        console.log("Todos los event listeners configurados correctamente.");

    // El catch para la configuración de listeners
    } catch (error) {
        console.error("Error crítico añadiendo event listeners:", error);
        alert("Error crítico al inicializar la página. Revisa la consola (F12).");
    }

    // ----- APLICAR PREFERENCIA DARK MODE AL CARGAR -----
    try {
        const savedPref = localStorage.getItem('darkModeAdminPref');
        const prefersDarkScheme = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
        let startDark = (savedPref === '1') || (savedPref === null && prefersDarkScheme);

        // Aplicar clase antes de animar iconos
        if (startDark) {
             document.body.classList.add('lp-dark');
        } else {
             document.body.classList.remove('lp-dark');
        }
        if(els.darkBtn) els.darkBtn.setAttribute('aria-pressed', String(startDark));

        // Animación inicial sin transición
        const initialIconAnimation = (icon, isShowing) => {
             if (!icon) return;
             icon.style.transition = 'none'; // Sin animación inicial
             icon.style.opacity = isShowing ? '1' : '0';
             icon.style.transform = isShowing ? 'scale(1)' : 'scale(0.8)';
             // Forzar reflow puede no ser necesario si se aplica antes de que el navegador pinte
             // requestAnimationFrame(() => { icon.style.transition = ''; }); // Restaurar transición
        };

        initialIconAnimation(els.sunIcon, !startDark);
        initialIconAnimation(els.moonIcon, startDark);
        // Restaurar transiciones después de un pequeño delay o en el siguiente frame
        requestAnimationFrame(() => {
             if (els.sunIcon) els.sunIcon.style.transition = '';
             if (els.moonIcon) els.moonIcon.style.transition = '';
        });


    } catch (storageError) {
        console.warn("No se pudo leer/aplicar preferencia de modo oscuro:", storageError);
    }

    // ----- INICIALIZAR UI -----
    try {
        setActiveSection('dashboard'); // Establece la sección inicial
        updateDashboardStats();      // Calcula estadísticas iniciales (serán 0)
        console.log("Admin panel UI initialized successfully.");
    } catch (error) {
        console.error("Error al inicializar UI:", error);
        alert("Error al inicializar la interfaz. Revisa la consola.");
    }

}); // Fin de DOMContentLoaded
