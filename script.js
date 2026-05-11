import map_distrito_concelhos from './concelhos_map.js';


const todosDistritosCheckbox = document.getElementById('Todos');
const checkboxesDistritos = document.querySelectorAll('input[name="distritos_selecionados"]');

// 
todosDistritosCheckbox.addEventListener('change', function() {
    const estado = todosDistritosCheckbox.checked;
    checkboxesDistritos.forEach(cb => {
        cb.checked = estado;
    });
});


checkboxesDistritos.forEach(cb => {
    cb.addEventListener('change', function() {
        if (!this.checked) {
            todosDistritosCheckbox.checked = false;
        } else {
            const todasMarcadas = Array.from(checkboxesDistritos).every(c => c.checked);
            if (todasMarcadas) {
                todosDistritosCheckbox.checked = true;
            }
        }
    });
});

function changePage(current_page, target_page) {

    if (current_page && target_page) {
        // hides current
        document.getElementById(current_page).style.display = 'none';
    
        // shows target
        document.getElementById(target_page).style.display = 'block';
    } else {
        console.error("Invalid IDs", current_page, target_page);
    }

    
}

function confirm_selection() {
    const checkboxes = document.querySelectorAll('input[name="distritos_selecionados"]:checked');

    if (checkboxes.length === 0) {
        alert("Selecione pelo menos um distrito.");
        return;
    }

    console.log("Opções selecionadas:", checkboxes.length);
    changePage("district_options_page","main_screen");
}


window.changePage = changePage;
window.confirm_selection = confirm_selection;
//pedirDados();