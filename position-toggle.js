// ==============================================
// POSITION TOGGLE FUNCTIONALITY
// ==============================================

document.addEventListener('DOMContentLoaded', function () {
    const toggleButtons = document.querySelectorAll('.position-toggle');
    const hiddenInput = document.getElementById('pad-posicion-value');

    // Función para actualizar el valor hidden basado en botones activos
    function updatePositionValue() {
        const activeButtons = Array.from(toggleButtons).filter(btn => btn.classList.contains('active'));
        const positions = activeButtons.map(btn => btn.dataset.position);

        if (hiddenInput) {
            hiddenInput.value = positions.length > 0 ? positions.join(', ') : 'Delantera';
        }

        console.log('Posiciones seleccionadas:', positions.join(', ') || 'Delantera');
    }

    // Event listener para cada botón
    toggleButtons.forEach(button => {
        button.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            // Toggle active class
            this.classList.toggle('active');

            // Asegurar que al menos uno esté activo
            const anyActive = Array.from(toggleButtons).some(btn => btn.classList.contains('active'));
            if (!anyActive) {
                this.classList.add('active');
            }

            updatePositionValue();
        });
    });

    // Inicializar valor
    updatePositionValue();

    console.log('✅ Position toggle buttons initialized');
});

// Función global para establecer posiciones desde el código
window.setPositionToggles = function (posicion) {
    const toggleButtons = document.querySelectorAll('.position-toggle');
    const hiddenInput = document.getElementById('pad-posicion-value');

    if (!posicion || posicion === '') {
        posicion = 'Delantera';
    }

    const positions = typeof posicion === 'string' ? posicion.split(',').map(p => p.trim()) : [posicion];

    toggleButtons.forEach(button => {
        const buttonPosition = button.dataset.position;
        if (positions.includes(buttonPosition)) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    if (hiddenInput) {
        hiddenInput.value = positions.join(', ');
    }
};

// Función global para obtener posiciones seleccionadas
window.getSelectedPositions = function () {
    const hiddenInput = document.getElementById('pad-posicion-value');
    return hiddenInput ? hiddenInput.value : 'Delantera';
};
