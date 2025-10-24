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
        if (!els.pageTitle) { throw new Error("Elemento 'page-title' no encontrado."); }
        console.log("DOM elements obtained successfully."); 
    } catch (error) {
        console.error("Error obtaining DOM elements:", error); 
        alert("Error crítico: No se encontraron elementos HTML necesarios. Revisa IDs y la consola (F12).");
        return; 
    }

    // ----- FUNCIONES -----

    // Función para cambiar de sección (Dashboard, Editar, etc.)
    const setActiveSection = (sectionId) => {
        if (!sectionId) {
            console.warn("setActiveSection llamada sin sectionId");
            return;
        }
        
        // Ocultar todas las secciones
        els.contentSections?.forEach(section => {
            section.classList.remove('active');
        });

        // Marcar el item de nav como activo
        els.navItems?.forEach(item => {
            item.classList.toggle('active', item.dataset.section === sectionId);
        });

        // Mostrar la sección correcta
        const activeSection = document.getElementById(sectionId);
        if (activeSection) {
            activeSection.classList.add('active');
            // Actualizar título de la página
            const navItem = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
            if (els.pageTitle && navItem) {
                els.pageTitle.textContent = navItem.querySelector('span:last-child').textContent;
            }
        } else {
            console.error(`Sección con ID '${sectionId}' no encontrada.`);
            document.getElementById('dashboard')?.classList.add('active'); // Fallback a dashboard
        }
    };

    // Resetea el formulario de añadir aplicación
    const resetAppForm = () => {
        els.appForm.reset();
        els.editingAppIndexInput.value = "-1";
        editingAppIndex = -1;
        els.addAppButtonText.textContent = "Añadir App";
        els.addUpdateAppBtn.classList.remove('btn-secondary');
        els.addUpdateAppBtn.classList.add('btn-tertiary');
        els.cancelEditAppBtn.style.display = 'none';
        els.appFormDescription.textContent = "Añade vehículos compatibles.";
    };

    // Resetea todos los formularios y el modo de edición
    const resetFormsAndMode = () => {
        els.padFormMain.reset();
        els.editIndexInput.value = "-1";
        editIndex = -1;
        currentApps = [];
        
        els.formModeTitle.textContent = "Añadir Nueva Pastilla";
        els.saveButtonText.textContent = "Guardar Pastilla";
        els.savePadBtn.classList.remove('btn-secondary');
        els.savePadBtn.classList.add('btn-primary');

        els.searchRef.value = '';
        els.searchResults.innerHTML = '';
        els.clearSearchBtn.style.display = 'none';

        resetAppForm();
        renderCurrentApps(); // Para mostrar "Ninguna todavía"
    };

    // Calcula el total de aplicaciones en la lista maestra
    const calculateTotalApps = () => masterPadList.reduce((t, p) => t + (p.aplicaciones?.length || 0), 0);

    // Actualiza las estadísticas del Dashboard
    const updateDashboardStats = () => {
        totalAppsInList = calculateTotalApps();
        if (els.padCountDashboard) {
            els.padCountDashboard.textContent = masterPadList.length;
        }
        if (els.appsTotalDashboard) {
            els.appsTotalDashboard.textContent = totalAppsInList;
        }
    };

    // Muestra un mensaje de estado temporal
    const showStatus = (element, message, isError = false, duration = 4000) => {
        if (!element) return;
        element.textContent = message;
        element.className = 'status-message'; // Reset classes
        element.classList.add(isError ? 'error' : 'success');
        
        setTimeout(() => {
            element.textContent = '';
            element.className = 'status-message';
        }, duration);
    };

    // Genera el string JSON formateado
    const generateJsonString = () => {
        if (masterPadList.length === 0) return '[]'; 
        
        // Ordenar alfabéticamente por la primera referencia
        masterPadList.sort((a, b) => {
            const refA = a.ref[0]?.toLowerCase() || '';
            const refB = b.ref[0]?.toLowerCase() || '';
            return refA.localeCompare(refB);
        });

        const compactJson = JSON.stringify(masterPadList); 
        // Añade un salto de línea después de cada objeto '}' para legibilidad
        const formattedJson = compactJson.replace(/},{/g, '},\n{');
        return formattedJson;
    };

    // Dibuja la lista de aplicaciones actuales en el formulario
    const renderCurrentApps = () => {
        if (!els.currentAppsList) return;
        
        if (currentApps.length === 0) {
            els.currentAppsList.innerHTML = '<li class="empty-list">Ninguna todavía</li>';
            return;
        }

        els.currentAppsList.innerHTML = currentApps.map((app, index) => `
            <li>
                <div class="app-info">
                    <strong>${app.marca} ${app.serie}</strong>
                    <span class="app-details">
                        ${[app.litros, app.anio, app.espec].filter(Boolean).join(' | ')}
                    </span>
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
        `).join('');
    };

    // Carga los datos de una aplicación en el formulario de apps para editarla
    const loadAppDataIntoForm = (index) => {
        const app = currentApps[index];
        if (!app) return;

        editingAppIndex = index;
        els.editingAppIndexInput.value = index;
        
        els.appMarca.value = app.marca || '';
        els.appSerie.value = app.serie || '';
        els.appLitros.value = app.litros || '';
        els.appAnio.value = app.anio || '';
        els.appEspec.value = app.espec || '';
        
        els.addAppButtonText.textContent = "Actualizar App";
        els.addUpdateAppBtn.classList.remove('btn-tertiary');
        els.addUpdateAppBtn.classList.add('btn-secondary'); // Cambia color a azul
        els.cancelEditAppBtn.style.display = 'inline-flex';
        els.appFormDescription.textContent = `Editando: ${app.marca} ${app.serie}`;
        
        els.appMarca.focus(); // Pone el foco en el primer campo
    };

    // Carga los datos de una pastilla completa en el formulario principal
    const loadPadDataIntoForms = (padData, index) => {
        editIndex = index;
        els.editIndexInput.value = index;

        els.padRef.value = padData.ref.join(', ');
        els.padOem.value = padData.oem.join(', ');
        els.padFmsi.value = padData.fmsi.join(', ');
        els.padPosicion.value = padData.posicion || 'Delantera';
        els.padMedidas.value = padData.medidas || '';
        els.padImagenes.value = padData.img.join(', ');
        
        currentApps = JSON.parse(JSON.stringify(padData.aplicaciones || [])); // Copia profunda
        
        els.formModeTitle.textContent = `Editando Pastilla: ${padData.ref[0]}`;
        els.saveButtonText.textContent = "Actualizar Pastilla";
        els.savePadBtn.classList.remove('btn-primary');
        els.savePadBtn.classList.add('btn-secondary'); // Color azul para modo edición
        
        els.clearSearchBtn.style.display = 'inline-flex';
        els.searchResults.innerHTML = ''; // Limpia resultados de búsqueda
        
        renderCurrentApps();
        resetAppForm();
        
        setActiveSection('edit-pad'); // Cambia a la pestaña de edición
        els.padRef.focus(); // Pone el foco en el primer campo
    };

    // Función Ripple Effect (para botones)
    const createRippleEffect = (event) => { 
        const button = event.currentTarget; 
        const circle = document.createElement('span'); 
        const diameter = Math.max(button.clientWidth, button.clientHeight); 
        const radius = diameter / 2; 
        const rect = button.getBoundingClientRect(); 
        circle.style.width = circle.style.height = `${diameter}px`; 
        circle.style.left = `${event.clientX - (rect.left + radius)}px`; 
        circle.style.top = `${event.clientY - (rect.top + radius)}px`; 
        circle.classList.add('ripple'); 
        const ripple = button.getElementsByClassName('ripple')[0]; 
        if (ripple) ripple.remove(); 
        button.appendChild(circle); 
        // Remove ripple after animation
        circle.addEventListener('animationend', () => circle.remove(), { once: true });
    };

    // ----- EVENT LISTENERS -----
    try {
        console.log("Adding event listeners...");

        // Navegación principal
        els.navItems?.forEach(item => { 
            item.addEventListener('click', (e) => { 
                e.preventDefault(); 
                setActiveSection(item.dataset.section); 
            }); 
        });

        // =============================================
        //  ¡ARREGLO #2: CARGA DE ARCHIVO JSON!
        // =============================================
        els.fileImport?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) {
                els.fileName.textContent = "Ningún archivo.";
                return;
            }

            els.fileName.textContent = file.name;
            const reader = new FileReader();

            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (Array.isArray(data)) {
                        masterPadList = data;
                        updateDashboardStats(); // Actualiza los números
                        showStatus(els.importStatus, `¡Éxito! Se cargaron ${masterPadList.length} pastillas.`, false);
                        console.log("Datos JSON cargados:", masterPadList);
                    } else {
                        throw new Error("El JSON no es un array.");
                    }
                } catch (err) {
                    console.error("Error al parsear JSON:", err);
                    showStatus(els.importStatus, `Error: El archivo no es un JSON válido. (${err.message})`, true);
                    masterPadList = []; // Resetea en caso de error
                    updateDashboardStats();
                }
            };

            reader.onerror = () => {
                console.error("Error al leer el archivo:", reader.error);
                showStatus(els.importStatus, "Error: No se pudo leer el archivo.", true);
            };

            reader.readAsText(file);
        });

        // Búsqueda de pastilla
        const performSearch = () => {
            const query = els.searchRef.value.trim().toLowerCase();
            if (query.length < 2) {
                els.searchResults.innerHTML = '<div class="search-feedback error">Escribe al menos 2 caracteres.</div>';
                return;
            }
            if (masterPadList.length === 0) {
                 els.searchResults.innerHTML = '<div class="search-feedback error">Carga un archivo data.json primero.</div>';
                return;
            }

            const results = [];
            masterPadList.forEach((pad, index) => {
                const foundRef = pad.ref.find(r => r.toLowerCase().includes(query));
                if (foundRef) {
                    results.push({ pad, index, foundRef });
                }
            });

            if (results.length === 0) {
                els.searchResults.innerHTML = `<div class="search-feedback">No se encontró nada para "${query}".</div>`;
            } else {
                els.searchResults.innerHTML = results.map(r => `
                    <div class="search-result-item">
                        <div>
                            <span class="search-result-ref">${r.foundRef}</span>
                            <span class="search-result-apps">(${r.pad.aplicaciones?.length || 0} apps)</span>
                        </div>
                        <button class="btn btn-secondary edit-btn" data-index="${r.index}">Cargar</button>
                    </div>
                `).join('');
            }
        };
        els.searchBtn?.addEventListener('click', performSearch);
        els.searchRef?.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); performSearch(); } });

        // Clic en el botón "Cargar" de los resultados de búsqueda
        els.searchResults?.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-btn')) {
                const index = parseInt(e.target.dataset.index, 10);
                const padData = masterPadList[index];
                if (padData) {
                    loadPadDataIntoForms(padData, index);
                }
            }
        });

        // Limpiar formulario y búsqueda
        els.clearSearchBtn?.addEventListener('click', resetFormsAndMode);

        // Añadir o actualizar una aplicación
        els.appForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            const app = {
                marca: els.appMarca.value.trim(),
                serie: els.appSerie.value.trim(),
                litros: els.appLitros.value.trim(),
                anio: els.appAnio.value.trim(),
                espec: els.appEspec.value.trim(),
            };

            if (!app.marca || !app.serie) {
                alert("Marca y Serie son obligatorios para la aplicación.");
                return;
            }

            if (editingAppIndex > -1) {
                // Actualizando
                currentApps[editingAppIndex] = app;
            } else {
                // Añadiendo nueva
                currentApps.push(app);
            }
            
            renderCurrentApps();
            resetAppForm();
        });

        // Cancelar edición de app
        els.cancelEditAppBtn?.addEventListener('click', resetAppForm);

        // Clic en botones "editar" o "eliminar" de la lista de apps
        els.currentAppsList?.addEventListener('click', (e) => {
            const button = e.target.closest('.app-action-btn');
            if (!button) return;

            const index = parseInt(button.dataset.index, 10);
            
            if (button.classList.contains('edit-app-btn')) {
                loadAppDataIntoForm(index);
            }
            
            if (button.classList.contains('remove-app-btn')) {
                if (confirm(`¿Seguro que quieres eliminar la aplicación "${currentApps[index].marca} ${currentApps[index].serie}"?`)) {
                    currentApps.splice(index, 1);
                    renderCurrentApps();
                    resetAppForm(); // Resetea por si estaba siendo editada
                }
            }
        });

        // Guardar (o Actualizar) la pastilla principal
        els.savePadBtn?.addEventListener('click', () => {
            const refs = els.padRef.value.split(',').map(s => s.trim()).filter(Boolean);
            if (refs.length === 0) {
                alert("La Referencia es obligatoria.");
                els.padRef.focus();
                return;
            }

            const newPad = {
                ref: refs,
                oem: els.padOem.value.split(',').map(s => s.trim()).filter(Boolean),
                fmsi: els.padFmsi.value.split(',').map(s => s.trim()).filter(Boolean),
                posicion: els.padPosicion.value,
                medidas: els.padMedidas.value.trim(),
                img: els.padImagenes.value.split(',').map(s => s.trim()).filter(Boolean),
                aplicaciones: currentApps, // Usa la lista de apps ya gestionada
            };

            let message = "";
            if (editIndex > -1) {
                // Actualizando
                masterPadList[editIndex] = newPad;
                message = `¡Pastilla "${newPad.ref[0]}" actualizada!`;
            } else {
                // Guardando nueva
                masterPadList.push(newPad);
                message = `¡Pastilla "${newPad.ref[0]}" guardada!`;
            }
            
            updateDashboardStats();
            resetFormsAndMode();
            setActiveSection('dashboard'); // Vuelve al dashboard
            // Muestra el status en el dashboard, no en la página de edición que ya se cerró
            showStatus(els.importStatus, message, false); 
        });

        // Generar y descargar JSON
        els.generateDownloadBtn?.addEventListener('click', () => {
            if (masterPadList.length === 0) {
                showStatus(els.downloadStatus, "No hay datos para generar.", true);
                return;
            }
            
            try {
                const jsonString = generateJsonString();
                els.jsonOutput.value = jsonString; // Muestra en el textarea
                
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'data.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                showStatus(els.downloadStatus, `data.json (${masterPadList.length} pastillas) generado.`, false);
                
            } catch (err) {
                 showStatus(els.downloadStatus, `Error al generar JSON: ${err.message}`, true);
            }
        });

        // Copiar JSON
        els.copyJsonBtn?.addEventListener('click', () => {
            if (els.jsonOutput.value.length === 0) {
                showStatus(els.copyStatus, "No hay JSON para copiar.", true);
                return;
            }
            navigator.clipboard.writeText(els.jsonOutput.value)
                .then(() => {
                    showStatus(els.copyStatus, "¡JSON copiado al portapapeles!", false);
                })
                .catch(err => {
                    showStatus(els.copyStatus, `Error al copiar: ${err.message}`, true);
                });
        });

        // Limpiar sesión
        els.clearAllBtn?.addEventListener('click', () => {
            if (confirm("¿Estás SEGURO de que quieres borrar todos los datos cargados en esta sesión? Esta acción no se puede deshacer.")) {
                masterPadList = [];
                totalAppsInList = 0;
                resetFormsAndMode();
                updateDashboardStats();
                els.jsonOutput.value = '';
                els.fileName.textContent = 'Ningún archivo.';
                showStatus(els.importStatus, "Sesión limpiada. Carga un nuevo archivo.", false);
                setActiveSection('dashboard');
            }
        });
        
        // =============================================
        //  ¡ARREGLO #1: ANIMACIÓN MODO OSCURO!
        // =============================================
        els.darkBtn?.addEventListener('click', (e) => {
            createRippleEffect(e);
            const isDark = document.body.classList.toggle('lp-dark');
            
            if(els.darkBtn) {
                els.darkBtn.setAttribute('aria-pressed', String(isDark));
            }

            // ---- ¡ESTA ES LA FUNCIÓN DE ANIMACIÓN QUE FALTABA! ----
            const iconAnimation = (icon, isShowing) => {
                if (!icon) return; // Seguridad
                icon.style.transition = 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out';
                icon.style.opacity = isShowing ? '1' : '0';
                icon.style.transform = isShowing ? 'scale(1)' : 'scale(0.8)';
            };
            // ------------------------------------------

            iconAnimation(els.sunIcon, !isDark);
            iconAnimation(els.moonIcon, isDark);
            
            try { 
                localStorage.setItem('darkModeAdminPref', isDark ? '1' : '0'); 
            } 
            catch (storageError) { 
                console.warn("No se pudo guardar pref modo oscuro", storageError); 
            }
        });

        console.log("Event listeners added successfully."); 
    } catch (error) {
         console.error("Error adding event listeners:", error); 
         alert("Error crítico al inicializar acciones. Revisa consola (F12).");
         return; 
    }
    
    // ----- APLICAR PREFERENCIA DARK MODE AL CARGAR -----
    try {
        const savedPref = localStorage.getItem('darkModeAdminPref');
        const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
        let startDark = (savedPref === '1') || (savedPref === null && prefersDarkScheme);

        // Asegúrate de que los iconos correctos se muestren al cargar
        if (startDark) {
            document.body.classList.add('lp-dark');
            if(els.darkBtn) els.darkBtn.setAttribute('aria-pressed', 'true');
            if(els.sunIcon) {
                els.sunIcon.style.opacity = '0';
                els.sunIcon.style.transform = 'scale(0.8)';
            }
            if(els.moonIcon) {
                els.moonIcon.style.opacity = '1';
                els.moonIcon.style.transform = 'scale(1)';
            }
        } else {
            document.body.classList.remove('lp-dark');
             if(els.darkBtn) els.darkBtn.setAttribute('aria-pressed', 'false');
            if(els.sunIcon) {
                els.sunIcon.style.opacity = '1';
                els.sunIcon.style.transform = 'scale(1)';
            }
            if(els.moonIcon) {
                els.moonIcon.style.opacity = '0';
                els.moonIcon.style.transform = 'scale(0.8)';
            }
        }
    } catch (storageError) { 
        console.warn("No se pudo leer pref modo oscuro", storageError);
    }

    // Inicializar UI
    try {
        setActiveSection('dashboard');
        updateDashboardStats();
        console.log("Admin panel UI initialized successfully.");
    } catch (error) {
        console.error("Error al inicializar UI:", error);
    }

}); // Fin de DOMContentLoaded