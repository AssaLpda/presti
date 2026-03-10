import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Credenciales integradas
const firebaseConfig = {
    apiKey: "AIzaSyAiWAvf9Ezryg9Ut6RNkffzRHJh65rTL1M",
    authDomain: "prestamos-cb215.firebaseapp.com",
    projectId: "prestamos-cb215",
    storageBucket: "prestamos-cb215.firebasestorage.app",
    messagingSenderId: "346990294352",
    appId: "1:346990294352:web:1bb94849abda609ff6a855",
    measurementId: "G-XPVD66YCV6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
let prestamosLocal = []; 

// --- NAVEGACIÓN ---
window.switchTab = (tab) => {
    document.getElementById('tab-nuevo').classList.toggle('hidden', tab !== 'nuevo');
    document.getElementById('tab-lista').classList.toggle('hidden', tab !== 'lista');
};

// --- VISIBILIDAD DEL DASHBOARD ---
window.toggleVisibilidadTotales = () => {
    const cont = document.getElementById('contenedorTotales');
    const text = document.getElementById('eyeText');
    const icon = document.getElementById('eyeIcon');
    
    if (cont.classList.contains('blur-sm')) {
        cont.classList.remove('blur-sm', 'opacity-50', 'select-none');
        text.innerText = "Ocultar Totales";
        icon.innerText = "🙈";
    } else {
        cont.classList.add('blur-sm', 'opacity-50', 'select-none');
        text.innerText = "Mostrar Totales";
        icon.innerText = "👁️";
    }
};

// --- CÁLCULOS EN TIEMPO REAL AL REGISTRAR ---
const form = document.getElementById('loanForm');
form.addEventListener('input', () => {
    const monto = parseFloat(document.getElementById('monto').value) || 0;
    const plazo = document.getElementById('plazo').value;
    const resDiv = document.getElementById('resumenFlotante');
    
    if(monto > 0) {
        resDiv.classList.remove('hidden');
        let tasa = { '1w':0.15, '2w':0.30, '3w':0.45, '1m':0.60, '2m':1.20, '3m':1.80 }[plazo];
        const intTotal = monto * tasa;
        document.getElementById('resTotal').innerText = `$${(monto + intTotal).toLocaleString()}`;
        document.getElementById('resComision').innerText = `$${(intTotal / 3).toLocaleString()}`;
        document.getElementById('resTuya').innerText = `$${(intTotal / 3 * 2).toLocaleString()}`;
    } else {
        resDiv.classList.add('hidden');
    }
});

// --- GUARDAR PRÉSTAMO ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const plazoVal = document.getElementById('plazo').value;
    const numSemanas = plazoVal.includes('w') ? parseInt(plazoVal) : parseInt(plazoVal) * 4;
    
    const data = {
        nombre: document.getElementById('nombre').value,
        dni: document.getElementById('dni').value || "S/D",
        fechaInicio: document.getElementById('fecha').value,
        monto: parseFloat(document.getElementById('monto').value),
        plazo: plazoVal,
        numSemanas: numSemanas,
        socio: document.getElementById('socio').value, // Guardamos el socio seleccionado
        pagos: new Array(numSemanas).fill(false)
    };

    try {
        await addDoc(collection(db, "prestamos"), data);
        form.reset();
        document.getElementById('resumenFlotante').classList.add('hidden');
        alert("✅ Préstamo guardado correctamente");
    } catch (err) {
        alert("Error al guardar: " + err.message);
    }
});

// --- DASHBOARD: ACTUALIZAR NÚMEROS TOTALES SEGÚN FILTRO ---
function actualizarDashboard(prestamos) {
    let capital = 0;
    let ganancia = 0;
    const tasas = { '1w':0.15, '2w':0.30, '3w':0.45, '1m':0.60, '2m':1.20, '3m':1.80 };
    const filtroSocio = document.getElementById('filtroSocio').value;

    prestamos.forEach(p => {
        // Solo sumamos al dashboard si coincide con el socio filtrado
        if (filtroSocio === "todos" || p.socio === filtroSocio) {
            capital += p.monto;
            let tasa = tasas[p.plazo] || 0;
            ganancia += (p.monto * tasa);
        }
    });

    document.getElementById('totalCapital').innerText = `$${capital.toLocaleString()}`;
    document.getElementById('totalGanancia').innerText = `$${ganancia.toLocaleString()}`;
    document.getElementById('totalGeneral').innerText = `$${(capital + ganancia).toLocaleString()}`;
}

// --- LISTADO EN TIEMPO REAL ---
onSnapshot(collection(db, "prestamos"), (snapshot) => {
    prestamosLocal = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    actualizarDashboard(prestamosLocal);
    renderizarLista();
});

// Función global para que el select de socios pueda disparar el renderizado
window.renderizarLista = () => {
    const lista = document.getElementById('listaPrestamos');
    const busqueda = document.getElementById('buscador').value.toLowerCase();
    const filtroSocio = document.getElementById('filtroSocio').value;
    lista.innerHTML = "";

    // Filtrar por nombre/DNI y por Socio
    const filtrados = prestamosLocal.filter(p => {
        const coincideNombre = p.nombre.toLowerCase().includes(busqueda) || p.dni.includes(busqueda);
        const coincideSocio = filtroSocio === "todos" || p.socio === filtroSocio;
        return coincideNombre && coincideSocio;
    });

    // Actualizamos dashboard cada vez que se filtra para que los números coincidan con lo que vemos
    actualizarDashboard(prestamosLocal);

    if(filtrados.length === 0) {
        lista.innerHTML = `<p class="text-center text-slate-500 py-10">No se encontraron clientes.</p>`;
        return;
    }

    filtrados.forEach(p => {
        const cuotasPagadas = p.pagos.filter(pago => pago === true).length;
        const totalCuotas = p.numSemanas;
        const porcentaje = (cuotasPagadas / totalCuotas) * 100;
        
        const tieneMora = p.pagos.some((pago, index) => {
            if (pago) return false;
            let fVence = new Date(p.fechaInicio);
            fVence.setMinutes(fVence.getMinutes() + fVence.getTimezoneOffset());
            fVence.setDate(fVence.getDate() + ((index + 1) * 7));
            return new Date() > fVence;
        });

        lista.innerHTML += `
            <div class="bg-slate-800 p-5 rounded-xl flex justify-between items-center border ${tieneMora ? 'border-red-500/50' : 'border-slate-700'} shadow-lg hover:border-blue-500 transition">
                <div class="flex-1">
                    <div class="flex items-center gap-2">
                        <h4 class="text-lg font-bold text-white">${p.nombre}</h4>
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${p.socio === 'Assa' ? 'bg-purple-600' : 'bg-orange-600'} text-white uppercase">${p.socio}</span>
                        ${tieneMora ? '<span class="bg-red-500 text-[10px] px-2 py-0.5 rounded-full font-bold">MORA</span>' : ''}
                    </div>
                    <p class="text-sm text-slate-400 italic">Monto: $${p.monto.toLocaleString()} | ${p.plazo}</p>
                    <div class="w-48 h-1.5 bg-slate-700 rounded-full mt-2 overflow-hidden">
                        <div class="h-full bg-green-500" style="width: ${porcentaje}%"></div>
                    </div>
                    <p class="text-[10px] text-slate-500 mt-1">${cuotasPagadas} de ${totalCuotas} cuotas cobradas</p>
                </div>
                <button onclick="verDetalle('${p.id}')" class="bg-blue-600 hover:bg-blue-500 px-5 py-2 rounded-lg font-bold transition text-sm shadow-md">
                    GESTIONAR
                </button>
            </div>
        `;
    });
}

document.getElementById('buscador').addEventListener('input', window.renderizarLista);

// --- MODAL: DETALLES ---
window.verDetalle = (id) => {
    const p = prestamosLocal.find(item => item.id === id);
    if(!p) return;

    document.getElementById('modalNombre').innerText = p.nombre;
    
    // Configurar la etiqueta de socio en el modal
    const tag = document.getElementById('modalSocioTag');
    tag.innerText = p.socio;
    tag.className = `px-2 py-1 rounded text-[10px] font-black uppercase text-white ${p.socio === 'Assa' ? 'bg-purple-600' : 'bg-orange-600'}`;

    const tasas = { '1w':0.15, '2w':0.30, '3w':0.45, '1m':0.60, '2m':1.20, '3m':1.80 };
    const totalConInteres = p.monto * (1 + (tasas[p.plazo] || 0));
    const montoCuota = totalConInteres / p.numSemanas;
    
    document.getElementById('modalMeta').innerHTML = `Inició: ${p.fechaInicio} | DNI: ${p.dni} | Total: <b>$${totalConInteres.toLocaleString()}</b>`;

    let html = "";
    let fechaHoy = new Date();
    fechaHoy.setHours(0,0,0,0);
    
    for(let i=0; i < p.numSemanas; i++) {
        let fechaVence = new Date(p.fechaInicio);
        fechaVence.setMinutes(fechaVence.getMinutes() + fechaVence.getTimezoneOffset());
        fechaVence.setDate(fechaVence.getDate() + ((i + 1) * 7));

        const estaPagado = p.pagos[i];
        const esMora = !estaPagado && fechaHoy > fechaVence;
        
        let statusClass = estaPagado ? 'card-pagado' : (esMora ? 'card-mora' : 'card-pendiente');
        let statusText = estaPagado ? 'PAGADO ✅' : (esMora ? '⚠️ EN MORA' : 'PENDIENTE');

        html += `
            <div class="p-4 rounded-lg flex items-center justify-between transition mb-2 ${statusClass}">
                <div>
                    <span class="text-[10px] font-black opacity-60 uppercase tracking-widest">Semana ${i+1}</span>
                    <p class="font-bold text-white">${fechaVence.toLocaleDateString()}</p>
                    <p class="text-sm">$${montoCuota.toLocaleString()} - <span class="font-bold text-xs">${statusText}</span></p>
                </div>
                <div class="flex gap-2">
                    <button onclick="marcarPago('${p.id}', ${i}, true)" class="bg-green-600 p-2 rounded-lg hover:bg-green-500 transition shadow-lg">✔</button>
                    <button onclick="marcarPago('${p.id}', ${i}, false)" class="bg-red-600 p-2 rounded-lg hover:bg-red-500 transition shadow-lg">✖</button>
                </div>
            </div>
        `;
    }

    document.getElementById('cronogramaPagos').innerHTML = html;
    document.getElementById('btnEliminar').onclick = () => eliminarCliente(id);
    document.getElementById('modal').classList.remove('hidden');
};

// --- ACTUALIZAR PAGO ---
window.marcarPago = async (id, index, estado) => {
    const p = prestamosLocal.find(item => item.id === id);
    const nuevosPagos = [...p.pagos];
    nuevosPagos[index] = estado;
    
    p.pagos = nuevosPagos;
    verDetalle(id); 

    try {
        await updateDoc(doc(db, "prestamos", id), { pagos: nuevosPagos });
    } catch (err) {
        console.error("Error al actualizar:", err);
    }
};

// --- ELIMINAR CLIENTE ---
async function eliminarCliente(id) {
    if(confirm("⚠ ¿Estás seguro?")) {
        try {
            await deleteDoc(doc(db, "prestamos", id));
            cerrarModal();
        } catch (err) {
            alert("Error al eliminar");
        }
    }
}

window.cerrarModal = () => document.getElementById('modal').classList.add('hidden');